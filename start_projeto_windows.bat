@echo off
title Iniciar Projeto EcoIA
pause

REM Ativar ambiente do Rasa e treinar
echo Ativando ambiente virtual do Rasa...
call .\venv-rasa\Scripts\activate
echo Ambiente Rasa ATIVADO.
pause

echo Treinando modelo Rasa...
rasa train
pause

echo Iniciando Rasa (API) em nova janela...
start cmd /k "call .\venv-rasa\Scripts\activate && rasa run --enable-api --cors '*' --debug"
pause

REM Espera um pouco para garantir que o Rasa suba antes de chamar o backend
timeout /t 5
pause

REM Ativar ambiente vetores e rodar (se necessário)
echo Ativando ambiente venv-vetores...
call .\venv-vetores\Scripts\activate
echo Ambiente vetores ATIVADO.
pause

echo Iniciando FAISS API no vector_service.py...
start cmd /k "call .\venv-vetores\Scripts\activate && python vector_service.py"
pause

REM Ativar ambiente Flask e rodar main.py
echo Ativando ambiente Flask...
call .\venv-flask\Scripts\activate
echo Ambiente Flask ATIVADO.
pause

REM Iniciar retrain_bot.py em nova janela (após ativar o ambiente Flask)
echo Iniciando retrain_bot.py em nova janela...
start cmd /k "call .\venv-flask\Scripts\activate && python retrain_bot.py"
pause

echo Rodando main.py com Flask...
python main.py
pause