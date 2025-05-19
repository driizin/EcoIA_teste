from flask import Flask, render_template, request, jsonify
from sqlalchemy import create_engine, Column, Integer, String, ForeignKey, Text, TIMESTAMP
from sqlalchemy.orm import sessionmaker, declarative_base, relationship
from sqlalchemy.sql import func
import json
import os
import google.generativeai as genai
import openai
import base64
from datetime import datetime
from sqlalchemy.dialects.mysql import LONGTEXT
import spacy
from spacy.matcher import Matcher
import schedule
import time
from multiprocessing import Process
import threading
from dotenv import load_dotenv
import requests
from actions.refinador_chatgpt import aprimorar_texto, gerar_intents_exemplos
import yaml
from ruamel.yaml import YAML
import subprocess
import logging

# Configurações de logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] - %(message)s',
    handlers=[
        logging.FileHandler('main.log', encoding='utf-8'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# Carrega variáveis de ambiente e NLP
load_dotenv()
nlp = spacy.load("pt_core_news_sm")
matcher = Matcher(nlp.vocab)

# Padrões para detectar correções
correction_patterns = [
    [{"LOWER": "não"}, {"POS": "ADV", "OP": "*"}, {"LOWER": {"IN": ["é", "foi", "está", "era"]}}, {"POS": "ADV", "OP": "*"}, {"DEP": "ROOT"},
        {"LOWER": ","}, {"LOWER": {"IN": ["na", "em"]}, "OP": "?"}, {"LOWER": "verdade"}, {"LOWER": ","}, {"DEP": "ROOT", "OP": "+"}],
    [{"LOWER": {"IN": ["isso", "aquilo"]}}, {"LOWER": {"IN": ["não", "tá", "está"]}},
        {"LOWER": "certo"}, {"LOWER": ","}, {"DEP": "ROOT", "OP": "+"}],
    [{"LOWER": {"IN": ["você", "ele", "ela"]}}, {"LOWER": {"IN": ["se", "me", "nos"]}}, {"LOWER": "enganou"}, {
        "LOWER": ","}, {"LOWER": "o"}, {"LOWER": "correto"}, {"LOWER": {"IN": ["é", "era", "foi"]}}, {"DEP": "ROOT", "OP": "+"}],
    [{"LOWER": {"IN": ["a", "o"]}}, {"LOWER": "resposta"}, {"LOWER": "estava"}, {"LOWER": {"IN": ["errada", "incorreta"]}}, {
        "LOWER": ","}, {"LOWER": "o"}, {"LOWER": "certo"}, {"LOWER": {"IN": ["é", "era", "foi"]}}, {"DEP": "ROOT", "OP": "+"}],
    [{"LOWER": "na"}, {"LOWER": "realidade"}, {
        "LOWER": ","}, {"DEP": "ROOT", "OP": "+"}],
]

for pattern in correction_patterns:
    matcher.add("IMPLICIT_CORRECTION", [pattern])

app = Flask(__name__)

# Configuração do Banco de Dados MySQL
Base = declarative_base()


class Conversation(Base):
    __tablename__ = 'conversations'
    id = Column(Integer, primary_key=True)
    title = Column(String, default='Nova Conversa')
    created_at = Column(TIMESTAMP, server_default=func.now())
    messages = relationship(
        "Message", back_populates="conversation", cascade="all, delete-orphan")
    feedback_corrections = relationship(
        "FeedbackCorrection", back_populates="conversation")


class Message(Base):
    __tablename__ = 'messages'
    id = Column(Integer, primary_key=True)
    conversation_id = Column(Integer, ForeignKey('conversations.id'))
    text = Column(String)
    image_data = Column(LONGTEXT)
    sender = Column(String)
    created_at = Column(TIMESTAMP, server_default=func.now())
    conversation = relationship("Conversation", back_populates="messages")
    feedback_corrections = relationship(
        "FeedbackCorrection", back_populates="message")


class FeedbackCorrection(Base):
    __tablename__ = 'feedback_corrections'
    id = Column(Integer, primary_key=True)
    conversation_id = Column(Integer, ForeignKey('conversations.id'))
    message_id = Column(Integer, ForeignKey('messages.id'))
    feedback_type = Column(String(50))
    feedback_text = Column(String(255))
    correction_text = Column(LONGTEXT)
    user_id = Column(Integer)
    created_at = Column(TIMESTAMP, server_default=func.now())
    conversation = relationship(
        "Conversation", back_populates="feedback_corrections")
    message = relationship("Message", back_populates="feedback_corrections")


DB_HOST = os.environ.get("DB_HOST", "localhost")
DB_USER = os.environ.get("DB_USER", "root")
DB_PASSWORD = os.environ.get("DB_PASSWORD", "")
DB_NAME = os.environ.get("DB_NAME", "chatbot")

DATABASE_URL = f"mysql+mysqlconnector://{DB_USER}:{DB_PASSWORD}@{DB_HOST}/{DB_NAME}"


def get_db():
    engine = create_engine(DATABASE_URL)  # Colocado dentro do generator
    SessionLocal = sessionmaker(bind=engine)
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# Configuração da API do ChatGPT
openai.api_key = os.getenv("OPENAI_CHATGPT_API_KEY")
if openai.api_key is None:
    raise ValueError(
        "A chave OPENAI_CHAT_GPT_API_KEY não está definida no ambiente.")


# Configuração da API do Gemini
GOOGLE_GEMINI_API_KEY = os.environ.get("GOOGLE_GEMINI_API_KEY")
if GOOGLE_GEMINI_API_KEY is None:
    raise ValueError(
        "A variável de ambiente GOOGLE_GEMINI_API_KEY não está definida.")
genai.configure(api_key=GOOGLE_GEMINI_API_KEY)
# Escolha um modelo que suporte multimodalidade
model_gemini = genai.GenerativeModel("gemini-2.0-flash")


def obter_resposta_gemini(user_message, image_data=None):
    prompt_markdown = f"""
Responda com formatação Markdown (sem explicar que está usando markdown), incluindo:

- Títulos com `#`
- Subtítulos com `##`
- Listas com `-`
- Parágrafos bem definidos

Mensagem do usuário:
{user_message}
"""

    content_parts = [prompt_markdown]
    if image_data:
        try:
            image_bytes = base64.b64decode(image_data.split(',')[1])
            content_parts.append(
                {"mime_type": "image/jpeg", "data": image_bytes})
        except Exception as e:
            return f"Erro ao decodificar a imagem: {e}"

    try:
        response = model_gemini.generate_content(content_parts)
        response.resolve()
        bot_message = response.text if response and response.text else \
            "Desculpe, não consegui gerar uma resposta para essa mensagem (e/ou imagem)."
    except Exception as e:
        bot_message = f"Erro ao gerar resposta da Gemini: {e}"

    return bot_message


def obter_resposta_rasa(user_message):
    try:
        response = requests.post(
            "http://localhost:5005/webhooks/rest/webhook",
            json={"sender": "usuario", "message": user_message}
        )
        data = response.json()
        return data[0]['text'] if data else "Desculpe, não entendi sua pergunta."
    except Exception as e:
        return f"Erro ao se comunicar com o Rasa: {e}"


def gerar_vetor(texto):
    try:
        response = requests.post(
            'http://localhost:6000/embed', json={'text': texto})
        if response.status_code == 200:
            return response.json()['embedding']
        else:
            return None
    except Exception as e:
        logger.error(f"Erro ao obter vetor: {e}")
        return None


def buscar_em_base_vetorial(pergunta):
    try:
        response = requests.post(
            'http://localhost:6000/embed',
            json={'text': pergunta}
        )
        if response.status_code == 200:
            data = response.json()
            resposta = data.get('resposta')
            score = data.get('score', 0)
            if resposta and score > 0.7:  # ajuste de sensibilidade
                return resposta
    except Exception as e:
        logger.warning(f"Erro ao consultar base vetorial: {e}")
    return None


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/api/history')
def get_history():
    db = next(get_db())
    conversations = db.query(Conversation).order_by(
        Conversation.created_at.desc()).all()
    return jsonify([{'id': c.id, 'title': c.title} for c in conversations])


@app.route('/api/conversations/<int:conversation_id>', methods=['DELETE'])
def delete_conversation(conversation_id):
    db = next(get_db())
    conv = db.query(Conversation).filter(
        Conversation.id == conversation_id).first()
    if conv:
        db.delete(conv)
        db.commit()
        return jsonify({'message': f'Conversa {conversation_id} excluída com sucesso!'}), 200
    return jsonify({'error': 'Conversa não encontrada'}), 404


@app.route('/api/conversations/<int:conversation_id>', methods=['PUT'])
def rename_conversation(conversation_id):
    data = request.get_json()
    new_title = data.get('title')
    if not new_title:
        return jsonify({'error': 'Título não fornecido'}), 400

    db = next(get_db())
    conv = db.query(Conversation).filter(
        Conversation.id == conversation_id).first()
    if conv:
        conv.title = new_title
        db.commit()
        return jsonify({'message': f'Conversa {conversation_id} renomeada para "{new_title}"'}), 200
    return jsonify({'error': 'Conversa não encontrada'}), 404


@app.route('/api/conversations/<int:conversation_id>')
def get_conversation(conversation_id):
    db = next(get_db())
    conv = db.query(Conversation).filter(
        Conversation.id == conversation_id).first()
    if conv:
        return jsonify([{'text': m.text, 'image_data': m.image_data, 'sender': m.sender} for m in conv.messages])
    return jsonify([])


@app.route('/api/chat', methods=['POST'])
def chat():
    data = request.get_json()
    user_message = data.get('message', '')
    image_base64 = data.get('image')
    conversation_id = data.get('conversation_id')
    db = next(get_db())

    if image_base64:
        print(f"Tamanho da base64 recebida: {len(image_base64)}")

    if conversation_id:
        conv = db.query(Conversation).filter(
            Conversation.id == conversation_id).first()
    else:
        conv = Conversation()
        db.add(conv)
        db.commit()
        db.refresh(conv)
        # Extração de palavras-chave com spaCy
        doc = nlp(user_message)
        keywords = [
            token.text for token in doc
            if not token.is_stop and token.is_alpha and len(token.text) > 2
        ]
        palavras_chave = " ".join(dict.fromkeys(
            keywords[:3])) if keywords else "Nova Conversa"
        conv.title = palavras_chave.capitalize()
        db.commit()
        db.refresh(conv)
        conversation_id = conv.id

    if conv:
        last_bot_message = db.query(Message).filter(
            Message.conversation_id == conversation_id,
            Message.sender == 'bot'
        ).order_by(Message.created_at.desc()).first()

        # Armazenar a mensagem do usuário
        user_message_entry = Message(conversation_id=conversation_id,
                                     text=user_message, sender='user')
        if image_base64:
            user_message_entry.image_data = image_base64
            print(
                f"Tamanho da base64 ANTES de adicionar ao DB: {len(user_message_entry.image_data)}")
        db.add(user_message_entry)
        db.commit()
        if image_base64:
            db.refresh(user_message_entry)
            print(
                f"Tamanho da base64 DEPOIS de commitar ao DB: {len(user_message_entry.image_data)}")

        correction_detected = False
        correction_text = None

        doc = nlp(user_message.lower())
        matches = matcher(doc)

        for match_id, start, end in matches:
            string_id = nlp.vocab.strings[match_id]
            if string_id == "IMPLICIT_CORRECTION":
                correction_detected = True
                # Tenta extrair a parte da mensagem que contém a correção
                for token in doc[end:]:
                    if not token.is_stop and token.is_alpha and len(token.text) > 2:
                        correction_text = " ".join(
                            [t.text for t in doc[end:]])
                        break
                break

                if correction_detected and conversation_id:
                    last_bot_message = db.query(Message).filter(
                        Message.conversation_id == conversation_id,
                        Message.sender == 'bot'
                    ).order_by(Message.created_at.desc()).first()

            if last_bot_message:
                nova_feedback = FeedbackCorrection(
                    conversation_id=conversation_id,
                    message_id=last_bot_message.id,
                    feedback_type='correcao_usuario',
                    correction_text=correction_text
                )
                db.add(nova_feedback)
                db.commit()
                bot_response = "Obrigado pela sua correção! Registrei a informação para melhorar minhas respostas futuras."
            else:
                resposta_base = buscar_em_base_vetorial(user_message)
                if resposta_base:
                    bot_response = resposta_base
                else:
                    bot_response = obter_resposta_gemini(user_message, image_base64) if image_base64 else str(
                        obter_resposta_rasa(user_message))
        else:
            resposta_base = buscar_em_base_vetorial(user_message)
            if resposta_base:
                bot_response = resposta_base
            else:
                bot_response = obter_resposta_gemini(user_message, image_base64) if image_base64 else str(
                    obter_resposta_rasa(user_message))

        # Armazenar a resposta do bot
        bot_message_entry = Message(conversation_id=conversation_id,
                                    text=bot_response, sender='bot')
        db.add(bot_message_entry)
        db.commit()
        db.refresh(bot_message_entry)

        return jsonify({'response': bot_response, 'conversation_id': conversation_id, 'bot_message_id': bot_message_entry.id})
    return jsonify({'error': 'Erro ao processar a conversa'}), 500


CORRECTIONS_FILE = os.path.join(os.path.dirname(
    os.path.abspath(__file__)), 'corrections.txt')


@app.route('/api/feedback', methods=['POST'])
def feedback():
    data = request.get_json()
    message_id = data.get('message_id')
    feedback_type = data.get('feedback_type')
    conversation_id = data.get('conversation_id')
    correction_text = data.get('correction_text')

    db = next(get_db())

    # Garante que temos ID de mensagem e tipo de feedback
    if not message_id or not feedback_type:
        return jsonify({"error": "Campos obrigatórios ausentes."}), 400

    mensagem_usuario = db.query(Message).filter(
        Message.id == message_id, Message.sender == 'user'
    ).first()

    if not mensagem_usuario:
        return jsonify({"error": "Mensagem do usuário não encontrada."}), 404

    nova_feedback = FeedbackCorrection(
        conversation_id=conversation_id or mensagem_usuario.conversation_id,
        message_id=message_id,
        feedback_type=feedback_type,
        correction_text=correction_text
    )
    db.add(nova_feedback)
    db.commit()

    versao_refinada = None
    exemplos_nlu = None

    if correction_text:
        try:
            versao_refinada = aprimorar_texto(correction_text)
            exemplos_nlu = gerar_intents_exemplos(
                mensagem_usuario.text, correction_text
            )
        except Exception as e:
            logger.warning(f"Erro ao gerar sugestões com ChatGPT: {e}")

    with open(CORRECTIONS_FILE, 'a', encoding='utf-8') as f:
        mensagem_bot = db.query(Message).filter(
            Message.conversation_id == mensagem_usuario.conversation_id,
            Message.sender == 'bot',
            Message.created_at > mensagem_usuario.created_at
        ).order_by(Message.created_at).first()

        if feedback_type == 'negativo_com_correcao' and correction_text:
            f.write(
                f"CORRECAO_DIRETA: {mensagem_usuario.text} -> {correction_text}\n")
            logger.info("Correção direta adicionada a corrections.txt")

        elif feedback_type == 'negativo' and mensagem_bot:
            f.write(f"NEGATIVO:USER: {mensagem_usuario.text}\n")
            f.write(f"NEGATIVO:BOT: {mensagem_bot.text}\n")
            logger.info("Feedback negativo (sem correção) adicionado")

        elif feedback_type == 'correcao_usuario' and correction_text and mensagem_bot:
            f.write(
                f"CORRECAO_DIRETA: {mensagem_usuario.text} -> {correction_text}\n")
            logger.info("Correção do usuário adicionada")

    if exemplos_nlu:
        with open("sugestoes_nlu_temp.json", "a", encoding="utf-8") as tempfile:
            tempfile.write(json.dumps(exemplos_nlu, ensure_ascii=False) + "\n")
            tempfile.write("\n")
        logger.info(f"Correção refinada: {versao_refinada}")
        logger.info(f"Sugestões para NLU: {exemplos_nlu}")

    return jsonify({'message': 'Feedback recebido com sucesso!'}), 200


def atualizar_nlu_yaml(intent, exemplos, arquivo_nlu='data/nlu.yml'):
    yaml = YAML()
    yaml.preserve_quotes = True
    yaml.indent(mapping=2, sequence=4, offset=2)

    if not os.path.exists(arquivo_nlu):
        raise FileNotFoundError(f"Arquivo {arquivo_nlu} não encontrado.")

    with open(arquivo_nlu, 'r', encoding='utf-8') as f:
        data = yaml.load(f)

    if 'nlu' not in data:
        data['nlu'] = []

    intents_existentes = {
        item['intent']: item for item in data['nlu'] if 'intent' in item}

    if intent in intents_existentes:
        intent_data = intents_existentes[intent]
        exemplos_existentes = set(
            map(str.strip, intent_data['examples'].split('\n')))
        novos_exemplos = set(f"- {ex.strip()}" for ex in exemplos)
        intent_data['examples'] = "\n".join(
            sorted(exemplos_existentes | novos_exemplos))
    else:
        novo_bloco = {
            'intent': intent,
            'examples': "\n".join(f"- {ex}" for ex in exemplos)
        }
        data['nlu'].append(novo_bloco)

    with open(arquivo_nlu, 'w', encoding='utf-8') as f:
        yaml.dump(data, f)

    print(
        f"[NLU] Intent '{intent}' atualizada com {len(exemplos)} exemplo(s).")


def export_data_to_corrections():
    engine = create_engine(DATABASE_URL)
    SessionLocal = sessionmaker(bind=engine)
    db = SessionLocal()
    try:
        with open(CORRECTIONS_FILE, 'a', encoding='utf-8') as f:
            # Exportar interações marcadas como negativas
            negative_feedback = db.query(FeedbackCorrection).filter(
                FeedbackCorrection.feedback_type == 'negativo'
            ).all()

            for feedback in negative_feedback:
                mensagem_usuario = db.query(Message).filter(
                    Message.id == feedback.message_id,
                    Message.sender == 'user'
                ).first()

                if not mensagem_usuario:
                    logger.warning(
                        f"[Corrections] Mensagem do usuário não encontrada para feedback_id={feedback.id}")
                    continue

                mensagem_bot = db.query(Message).filter(
                    Message.conversation_id == mensagem_usuario.conversation_id,
                    Message.sender == 'bot',
                    Message.created_at > mensagem_usuario.created_at
                ).order_by(Message.created_at).first()

                if not mensagem_bot:
                    logger.warning(
                        f"[Corrections] Mensagem do bot não encontrada após mensagem_id={mensagem_usuario.id}")
                    continue

                f.write(f"NEGATIVO:USER: {mensagem_usuario.text}\n")
                f.write(f"NEGATIVO:BOT: {mensagem_bot.text}\n")

            # Exportar correções diretas
            correcoes_diretas = db.query(FeedbackCorrection).filter(
                FeedbackCorrection.feedback_type.in_(
                    ['correcao_usuario', 'negativo_com_correcao']),
                FeedbackCorrection.correction_text != None
            ).all()

            for correcao in correcoes_diretas:
                mensagem_usuario = db.query(Message).filter(
                    Message.id == correcao.message_id,
                    Message.sender == 'user'
                ).first()

                if not mensagem_usuario:
                    logger.warning(
                        f"[Corrections] Usuário não encontrado para correção_id={correcao.id}")
                    continue

                f.write(
                    f"CORRECAO_DIRETA: {mensagem_usuario.text} -> {correcao.correction_text}\n")

        db.commit()
        logger.info("Dados do banco de dados exportados para corrections.txt")

    except Exception as e:
        logger.error(f"Erro ao exportar dados para corrections.txt: {e}")
    finally:
        db.close()


if __name__ == '__main__':
    # Inicia o processo de exportação inicial (opcional)
    export_process = Process(target=export_data_to_corrections)
    export_process.daemon = True
    export_process.start()

    # Roda retrain_bot.py como subprocesso
    retrain_scheduler = subprocess.Popen(
        ['python', 'retrain_bot.py'],
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT
    )

    try:
        app.run(debug=True)
    finally:
        # Finaliza o retrain_bot.py ao encerrar o Flask
        retrain_scheduler.terminate()
        retrain_scheduler.wait()
        print("⛔️ Scheduler de retreinamento encerrado.")
