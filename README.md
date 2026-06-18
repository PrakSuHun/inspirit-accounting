# 인스피릿 장부 (웹앱)

영상·사진 사업 재무 대시보드. **Next.js 16 + Google Sheets(=DB)** 구조.

- 로컬 개발: `.env.local` 의 `XLSX_PATH` 엑셀 파일을 직접 읽고/씀 (DATA_SOURCE=xlsx)
- 배포(추후): `DATA_SOURCE=sheets` 로 바꾸고 서비스 계정 키 설정 → Google Sheets API

## 실행
```bash
cd ~/inspirit-ledger
npm run dev   # http://localhost:3000 (사용중이면 3001)
```
로그인 비밀번호: `.env.local` 의 `APP_PASSWORD` (기본 inspirit2026)

## 화면 (하단 네비 5탭)
- `/`           대시보드 — 경영 순이익(대표 인건비 차감, 라이브), 매출/세이프박스, 차트, 경영 손익표
- `/projects`   프로젝트 — 검색·필터·정렬 / 추가·수정·삭제 / 워크플로우 체크 / 지출 기록
- `/payroll`    인건비·원천세 — 지급 기록 장부, 매월 10일 신고 일정, 지급명세서 엑셀 일괄등록·export
- `/expenses`   공통경비 — 판관비/영업외 관리, 추가·삭제
- `/tax`        세금 — 부가세(과세기간별), 종소세 추정(누진), 원천세 요약

## 세금 엔진 (lib/tax.ts)
정적 스냅샷 없이 원자료에서 라이브 계산. 부가세 과세기간별 / 원천세 3.3% / 종소세 누진 추정 /
경영순이익(대표 인건비 차감) vs 세무소득금액(미차감) 분리.

## 핵심 데이터 처리
- 날짜는 엑셀 serial 을 직접 변환 (cellDates 타임존 버그 회피)
- 쓰기 시 전체 워크북 재저장 → 외부에서 시트 동시 편집 금지
