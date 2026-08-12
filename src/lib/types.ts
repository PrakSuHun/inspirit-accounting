// 구글시트(=DB) 각 탭의 행 타입 정의

export type Account = {
  계좌명: string;
  은행: string;
  용도: string;
  세이프박스: string; // 'Y' | 'N'
  메모: string;
};

export type Client = {
  거래처명: string;
  사업자번호: string;
  메모: string;
};

export type Partner = {
  이름: string;
  소득구분: string;
  역할: string;
  상태: string;
  주민번호?: string; // 지급명세서용 (선택, 민감정보)
};

export type Project = {
  "프로젝트명(내부)": string;
  클라이언트: string;
  납품일: string;
  상태: string;
  공급가: number;
  부가세: number;
  계약합계: number;
  정산상태: string;
  계산서매핑: string;
};

export type ProjectCost = {
  프로젝트: string;
  구분: string; // 용역비 | 경비 | 대표인출
  지출일: string;
  내용: string;
  금액: number;
  파트너: string;
  지급여부: string;
  선금여부: string;
};

export type TaxInvoice = {
  구분: string; // 매출 | 매입
  작성일: string;
  승인번호: string;
  거래처: string;
  공급가: number;
  세액: number;
  합계: number;
  계산서품명: string;
  종류: string;
  프로젝트매핑: string;
};

export type CommonExpense = {
  지출일: string;
  구분: string;
  항목: string;
  금액: number;
};

export type CardInputVat = {
  연도: string | number;
  가맹점: string;
  사업자번호: string;
  공급가: number;
  매입세액: number;
  비과세: number;
  합계: number;
  유형: string;
};

export type Asset = {
  취득일: string;
  품명: string;
  취득가: number;
  상각방법: string;
  내용연수월: number;
  종료일: string;
  월감가상각: number;
};

export type BankTransaction = {
  해시: string;
  계좌: string;
  거래일시: string;
  입출: string; // 입금 | 출금
  금액: number;
  거래후잔액: number;
  거래구분: string;
  상대방: string;
  메모: string;
  자동분류: string;
  매칭상태: string;
  매칭ID: string;
};

export type TaxSetting = {
  항목: string;
  값: string;
  설명: string;
};

// 앤드원 정산 장부 (andone 탭) — 받아야 할 돈(청구) / 받은 돈(수령)
export type AndoneEntry = {
  날짜: string;
  구분: string; // 청구(받아야 할) | 수령(받은)
  내용: string;
  금액: number;
  경로업체: string; // 어느 업체를 통해 받았는지 (수령 시)
  프로젝트: string; // 연결 프로젝트(선택)
  집계제외: boolean; // Y면 목록엔 남지만 미수/합계 계산에서 제외
};

// 공식 간이지급명세서(사업소득) 기반 인건비/원천세 레코드 = 신고 진실값
export type PayrollEntry = {
  귀속연월: string; // YYYY-MM
  지급일: string;
  수령인: string;
  주민번호: string;
  지급액: number;
  국세: number;
  지방소득세: number;
  업종: string;
};

// 모든 탭을 담는 데이터셋
export type Ledger = {
  accounts: Account[];
  clients: Client[];
  partners: Partner[];
  projects: Project[];
  project_costs: ProjectCost[];
  tax_invoices: TaxInvoice[];
  common_expenses: CommonExpense[];
  card_input_vat: CardInputVat[];
  assets: Asset[];
  bank_transactions: BankTransaction[];
  tax_settings: TaxSetting[];
  payroll: PayrollEntry[]; // 공식 지급명세서 기반 인건비
};

// 대시보드 집계 결과
export type DashboardSummary = {
  year: number;
  매출: number;
  외주용역비: number;
  직접경비: number;
  공통경비: number;
  감가상각: number;
  순이익_경영용: number; // 대표인건비 차감
  소득금액_세무용: number; // 대표인건비 미차감
  부가세_납부예상: number;
  세이프박스잔액: number;
  프로젝트수: number;
  중개건수: number;
  자체제작건수: number;
};
