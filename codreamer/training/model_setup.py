from __future__ import annotations

import random
import os

from dotenv import load_dotenv
import art
from art.serverless.backend import ServerlessBackend

from ..core.config import RANDOM_SEED


async def create_and_register_model() -> art.TrainableModel:
    load_dotenv()
    random.seed(RANDOM_SEED)
    model = art.TrainableModel(
        name=os.getenv("ART_MODEL_NAME", "model"),
        project=os.getenv("ART_PROJECT", "codreamer"),
        base_model=os.getenv("ART_BASE_MODEL", "Qwen/Qwen2.5-14B-Instruct"),
    )
    backend = ServerlessBackend()
    await model.register(backend)
    return model

