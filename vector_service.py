from flask import Flask, request, jsonify
from sentence_transformers import SentenceTransformer
import numpy as np
import json

app = Flask(__name__)
model = SentenceTransformer('paraphrase-multilingual-MiniLM-L12-v2')

# Carrega base de conhecimento
with open('ecologia.json', 'r', encoding='utf-8') as f:
    base_conhecimento = json.load(f)

# Prepara os embeddings da base
base_embeddings = [
    {
        'pergunta': item['pergunta'],
        'resposta': item['resposta'],
        'vetor': model.encode(item['pergunta'])
    }
    for item in base_conhecimento
]

# Função de similaridade cosseno
def cosine_similarity(vec1, vec2):
    vec1 = np.array(vec1)
    vec2 = np.array(vec2)
    return np.dot(vec1, vec2) / (np.linalg.norm(vec1) * np.linalg.norm(vec2))

@app.route('/embed', methods=['POST'])
def responder_com_base_vetorial():
    data = request.get_json()
    text = data.get('text', '').strip()

    if not text:
        return jsonify({'error': 'Texto vazio'}), 400

    embedding_usuario = model.encode(text)

    # Calcula similaridade com cada item da base
    similaridades = [
        {
            'pergunta': item['pergunta'],
            'resposta': item['resposta'],
            'score': cosine_similarity(embedding_usuario, item['vetor'])
        }
        for item in base_embeddings
    ]

    # Ordena por maior similaridade
    similaridades.sort(key=lambda x: x['score'], reverse=True)

    melhor = similaridades[0]
    if melhor['score'] > 0.7:  # ajuste conforme sua sensibilidade
        return jsonify({'resposta': melhor['resposta'], 'score': melhor['score']})
    else:
        return jsonify({'resposta': 'Desculpe, não encontrei uma resposta apropriada na base.', 'score': melhor['score']})

if __name__ == '__main__':
    app.run(port=6000)