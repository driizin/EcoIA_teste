import os
import yaml
import logging
import subprocess
import json
import schedule
import time
from actions.refinador_chatgpt import aprimorar_texto, gerar_intents_exemplos

CORRECTIONS_FILE = os.path.join(os.path.dirname(__file__), 'corrections.txt')
TEMP_SUGESTOES_FILE = os.path.join(
    os.path.dirname(__file__), 'sugestoes_nlu_temp.json')
NLU_FILE = os.path.join(os.path.dirname(__file__), 'data', 'nlu.yml')

# Configura o log
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] - %(message)s',
    handlers=[
        logging.FileHandler('retrain_rasa.log', encoding='utf-8'),
        logging.StreamHandler()
    ]
)

INTENT_NAME = "correcao_usuario"


def carregar_nlu():
    if not os.path.exists(NLU_FILE):
        return {'version': '3.1', 'nlu': []}
    with open(NLU_FILE, 'r', encoding='utf-8') as f:
        return yaml.safe_load(f)


def salvar_nlu(data):
    with open(NLU_FILE, 'w', encoding='utf-8') as f:
        yaml.dump(data, f, allow_unicode=True, sort_keys=False)


def adicionar_exemplos(nlu_data, exemplos):
    for entry in nlu_data['nlu']:
        if entry['intent'] == INTENT_NAME:
            existentes = set(entry.get('examples', '').split('\n'))
            novos = set([f"- {ex}" for ex in exemplos])
            todos = existentes.union(novos)
            entry['examples'] = '\n'.join(sorted(todos))
            return
    # Se não encontrou o intent, adiciona um novo
    nlu_data['nlu'].append({
        'intent': INTENT_NAME,
        'examples': '\n'.join([f"- {ex}" for ex in exemplos])
    })


def processar_sugestoes_temp():
    if not os.path.exists(TEMP_SUGESTOES_FILE):
        return []

    exemplos = []
    with open(TEMP_SUGESTOES_FILE, 'r', encoding='utf-8') as f:
        for line in f:
            try:
                dados = json.loads(line.strip())

                if isinstance(dados, str):
                    # Tenta converter string YAML-like para exemplos
                    partes = dados.split("examples: |")
                    if len(partes) == 2:
                        linhas = partes[1].strip().split('\n')
                        exemplos.extend([
                            linha.strip("- ").strip()
                            for linha in linhas if linha.strip()
                        ])
                    else:
                        logging.warning("Formato inesperado na string YAML.")
                elif isinstance(dados, list):
                    exemplos.extend([
                        item['example']
                        for item in dados
                        if isinstance(item, dict) and item.get('example')
                    ])
                else:
                    logging.warning(
                        f"Formato inesperado em linha: {type(dados)}")

            except Exception as e:
                logging.warning(f"Erro ao ler linha do JSON: {e}")

    # Limpa o arquivo após uso
    open(TEMP_SUGESTOES_FILE, 'w').close()
    return exemplos


def processar_corrections():
    if not os.path.exists(CORRECTIONS_FILE):
        logging.warning(f"Arquivo {CORRECTIONS_FILE} não encontrado.")
        return []

    exemplos = []
    with open(CORRECTIONS_FILE, 'r', encoding='utf-8') as f:
        for linha in f:
            if '->' in linha:
                partes = linha.replace(
                    "CORRECAO_DIRETA:", "").strip().split("->")
                if len(partes) == 2:
                    pergunta = partes[0].strip()
                    correcao = partes[1].strip()
                    gerados = gerar_intents_exemplos(pergunta, correcao)
                    exemplos.extend([g['example']
                                    for g in gerados if 'example' in g])

    # Limpa o arquivo de correções
    open(CORRECTIONS_FILE, 'w').close()
    return exemplos


def treinar_modelo():
    try:
        subprocess.run(["rasa", "train"], check=True)
        logging.info("✅ Modelo treinado com sucesso.")
    except subprocess.CalledProcessError as e:
        logging.error(f"❌ Erro ao treinar modelo: {e}")


def main():
    logging.info("🔁 Iniciando processo de retreinamento Rasa...")

    exemplos_temp = processar_sugestoes_temp()
    exemplos_correcoes = processar_corrections()

    todos_exemplos = exemplos_temp + exemplos_correcoes

    if not todos_exemplos:
        logging.info("Nenhum novo exemplo encontrado. Nada a treinar.")
        return

    logging.info(f"Adicionando {len(todos_exemplos)} exemplos ao NLU...")

    # 👇 Log de cada exemplo individual
    logging.info("Exemplos coletados:")
    for exemplo in todos_exemplos:
        logging.info(f" - {exemplo}")

    nlu_data = carregar_nlu()
    adicionar_exemplos(nlu_data, todos_exemplos)
    salvar_nlu(nlu_data)

    treinar_modelo()


def agendar_retreinamento():
    logging.info("🕒 Agendamento de retreinamento a cada 1 minuto.")
    schedule.every(1).minutes.do(main)

    while True:
        schedule.run_pending()
        time.sleep(1)


if __name__ == '__main__':
    main()
    agendar_retreinamento()
