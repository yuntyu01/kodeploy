"""items CRUD 라우터. 최소한의 list/create 데모."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.items.model import Item
from app.items.schemas import ItemIn, ItemOut
from app.shared.db import get_db

router = APIRouter(prefix="/items", tags=["items"])


@router.get("", response_model=list[ItemOut])
def list_items(db: Session = Depends(get_db)):
    return db.query(Item).all()


@router.post("", response_model=ItemOut)
def create_item(payload: ItemIn, db: Session = Depends(get_db)):
    item = Item(name=payload.name)
    db.add(item)
    db.commit()
    # commit 후 refresh로 DB가 채운 id를 객체에 반영 (response_model이 ItemOut을 요구).
    db.refresh(item)
    return item
