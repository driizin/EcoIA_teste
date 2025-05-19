import os
import openai
from dotenv import load_dotenv

def aprimorar_texto(texto_original):
    """
    Usa o ChatGPT para reescrever o texto mantendo o significado, mas melhorando a clareza.
    """
    prompt = f"""
    Reescreva o seguinte feedback do usuário mantendo o mesmo significado, mas tornando-o mais claro e direto:

    "{texto_original}"
    """
    try:
        resposta = openai.ChatCompletion.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": "Você é um assistente que reescreve frases com mais clareza."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.4
        )
        return resposta.choices[0].message.content.strip()
    except Exception as e:
        return f"[Erro ao usar ChatGPT: {e}]"

def gerar_intents_exemplos(pergunta_usuario, resposta_bot):
    """
    Gera sugestões de intent e exemplos para nlu.yml com base na interação.
    """
    prompt = f"""
    Considere a seguinte interação:

    Pergunta do usuário: "{pergunta_usuario}"
    Resposta do bot: "{resposta_bot}"

    Gere uma intent apropriada com pelo menos 3 exemplos de variações da pergunta.
    Formato:
    - intent: nome_intent
      examples: |
        - variação 1
        - variação 2
        - variação 3
    """
    try:
        resposta = openai.ChatCompletion.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": "Você é um gerador de dados para treinamento de chatbot Rasa."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.5
        )
        return resposta.choices[0].message.content.strip()
    except Exception as e:
        return f"[Erro ao gerar intent: {e}]"

def sugestao_keywords_embedding(pergunta_usuario):
    """
    Sugere palavras-chave úteis para enriquecer embeddings ou base vetorial.
    """
    prompt = f"""
    Analise a seguinte pergunta:
    "{pergunta_usuario}"

    Retorne as palavras-chave mais importantes (de 3 a 5), separadas por vírgula, que representem bem o conteúdo da pergunta.
    """
    try:
        resposta = openai.ChatCompletion.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": "Você extrai palavras-chave para NLP."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.3
        )
        return resposta.choices[0].message.content.strip()
    except Exception as e:
        return f"[Erro ao gerar keywords: {e}]"