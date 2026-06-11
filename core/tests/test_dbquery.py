"""DB 콘솔 파서/페이징 판정 고정 — _wrappable과 기계가독 출력 파서.

_wrappable이 오판하면 SHOW/INSERT를 파생 테이블로 감싸 문법 오류가 되거나(과감지),
다중 문장이 LIMIT 없이 그대로 나간다(미감지). 현행 판정 그대로 고정한다.
"""

import pytest

from app.deploy import dbquery


# --- _wrappable — SELECT/WITH 단일 문장만 페이징 래핑 ---

@pytest.mark.parametrize("sql", [
    "SELECT * FROM t",
    "select 1;",                       # 꼬리 세미콜론은 제거 후 판정
    "WITH x AS (SELECT 1) SELECT * FROM x",
    "-- comment\nSELECT 1",            # 선행 라인 주석 스킵
    "/* block */ select 1",            # 선행 블록 주석 스킵
])
def test_wrappable_true(sql):
    assert dbquery._wrappable(sql) is True


@pytest.mark.parametrize("sql", [
    "SHOW TABLES",
    "INSERT INTO t VALUES (1)",
    "SELECT 1; SELECT 2",              # 다중 문장 — 감싸면 깨짐
    "EXPLAIN SELECT 1",
    "   ",
])
def test_wrappable_false(sql):
    assert dbquery._wrappable(sql) is False


# --- mysql --batch 출력 파서 ---

def test_unescape_mysql():
    assert dbquery._unescape_mysql("a\\tb") == "a\tb"
    assert dbquery._unescape_mysql("x\\ny") == "x\ny"
    assert dbquery._unescape_mysql("p\\\\q") == "p\\q"


def test_parse_mysql_rows():
    cols, rows = dbquery._parse_mysql("id\tname\n1\tAl\n2\tBo\n")
    assert cols == ["id", "name"]
    assert rows == [["1", "Al"], ["2", "Bo"]]


def test_parse_mysql_header_only_and_empty():
    assert dbquery._parse_mysql("id\tname") == (["id", "name"], [])
    assert dbquery._parse_mysql("") == ([], [])


# --- psql --csv 출력 파서 ---

def test_parse_csv_quoted_comma():
    cols, rows = dbquery._parse_csv('a,b\n1,"x,y"\n')
    assert cols == ["a", "b"]
    assert rows == [["1", "x,y"]]
