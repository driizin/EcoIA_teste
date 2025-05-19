from typing import Any, Dict, List
from rasa_sdk import Action, Tracker
from rasa_sdk.executor import CollectingDispatcher
import os

class ActionRegistrarCorrecao(Action):
    def name(self) -> str:
        return "action_registrar_correcao"

    def run(self, dispatcher: CollectingDispatcher,
            tracker: Tracker,
            domain: Dict[str, Any]) -> List[Dict[str, Any]]:

        user_message = tracker.latest_message.get('text')
        if not user_message:
            return []

        filepath = os.path.join(os.path.dirname(__file__), '..', 'corrections.txt')

        with open(filepath, 'a', encoding='utf-8') as f:
            f.write(f"CORRECAO_DIRETA: {user_message}\n")

        return []