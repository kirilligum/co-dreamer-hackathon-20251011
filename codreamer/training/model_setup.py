from __future__ import annotations

import random

from dotenv import load_dotenv
import art
from art.serverless.backend import ServerlessBackend

from ..core.config import RANDOM_SEED


async def create_and_register_model() -> art.TrainableModel:
    load_dotenv()
    random.seed(RANDOM_SEED)
    model = art.TrainableModel(
        name="model",
        project="codreamer",
        base_model="Qwen/Qwen2.5-14B-Instruct",
    )
    backend = ServerlessBackend()
    await model.register(backend)
    return model

