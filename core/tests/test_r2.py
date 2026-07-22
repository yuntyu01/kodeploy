"""R2 모듈의 네트워크 무관 부분 고정 — 버킷 이름 규칙 + ListObjectsV2 XML 파서.

S3 호출 자체(SigV4)는 실 토큰 검증 영역이라 제외. 파서는 스토리지 패널 UI의
입력이라 네임스페이스/URL 인코딩 처리를 고정한다.
"""

from app.deploy.stack import r2

_NS = 'xmlns="http://s3.amazonaws.com/doc/2006-03-01/"'


def test_bucket_name_prefix():
    # "kd-" 접두사: R2 최소 길이(3자) 보장 + KoDeploy 생성 버킷 식별
    assert r2.bucket_name("foo") == "kd-foo"


def test_parse_list_xml_truncated_with_url_encoding():
    xml = f"""<?xml version="1.0"?>
<ListBucketResult {_NS}>
  <IsTruncated>true</IsTruncated>
  <NextContinuationToken>tok==</NextContinuationToken>
  <Contents>
    <Key>img/a b.png</Key><Size>123</Size>
    <LastModified>2026-01-01T00:00:00Z</LastModified>
  </Contents>
</ListBucketResult>"""
    out = r2._parse_list_xml(xml, "https://pub.example")
    assert out["next"] == "tok=="
    obj = out["objects"][0]
    assert obj["key"] == "img/a b.png"
    assert obj["size"] == 123
    assert obj["url"] == "https://pub.example/img/a%20b.png"  # 공백 인코딩, '/' 보존


def test_parse_list_xml_not_truncated_and_no_public_base():
    xml = f"""<?xml version="1.0"?>
<ListBucketResult {_NS}>
  <IsTruncated>false</IsTruncated>
  <Contents><Key>k</Key><Size>abc</Size></Contents>
</ListBucketResult>"""
    out = r2._parse_list_xml(xml, "")
    assert out["next"] is None              # truncated=false면 토큰 무시
    assert out["objects"][0]["size"] == 0   # 비숫자 Size 방어
    assert out["objects"][0]["url"] is None # public base 없으면 URL 없음
