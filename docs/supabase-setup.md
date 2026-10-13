# 망고펜 Supabase 연결 준비

> **이 브랜치는 DB 준비용이며 main 웹 체험판에 영향을 주지 않습니다.** 기존 `gpt-lorebook` 데이터베이스에 적용하지 마세요.

## 1. 새 프로젝트 생성

망고펜 전용 Supabase 프로젝트를 새로 만든 뒤 조직과 프로젝트 비용을 확인합니다. 운영 전 단계에서는 프로젝트가 무료 플랜인지, 이메일 사용량·DB·AI API 한도를 꼭 확인하세요.

## 2. 초기 스키마

`supabase/migrations/20261013_mangopen_initial.sql`을 새 프로젝트에서 실행합니다. (다른 프로젝트에는 실행 금지.) RLS 정책: 공개 작품과 회차만 공개 조회 가능하며, 작성자 본인만 생성·수정·삭제 가능. 신고 레코드는 일반 사용자에게 읽기 권한이 없습니다. 유료 열람은 아직 활성화하지 않습니다.

## 3. 앱 인증 및 환경변수

- 브라우저: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- 서버 전용: `GEMINI_API_KEY`, `GEMINI_MODEL` (실제 제공 중인 모델을 선택)
- Supabase Auth 이메일 로그인 및 사이트 URL/Redirect URLs: `https://mangopen.vercel.app` 포함
- **비밀키, service role, API 키를 저장소나 채팅에 붙여넣지 마세요.** Vercel 환경변수 화면에서 직접 설정합니다.

실제 회원 저장과 AI 생성은 Next.js 앱 및 서버 라우트가 정상 배포된 뒤 활성화됩니다. 현재 main의 정적 HTML 데모는 Supabase와 연결되어 있지 않습니다.

## 4. 배포 전 체크리스트

- [ ] 전용 Supabase 프로젝트 생성 및 스키마 적용
- [ ] `works`, `chapters`, `reports`, `generation_usage` 4개 테이블 확인
- [ ] RLS 활성화, 익명 비공개 조회 차단 확인
- [ ] 서로 다른 두 테스트 계정 사이 수정·삭제 차단 확인
- [ ] Auth 이메일 확인/리다이렉트 설정
- [ ] 로그인·작품 저장 Next.js UI 통합 및 브라우저 테스트
- [ ] AI 서버 인증·재시도·사용량 제한·공개 콘텐츠 검토 설계 완료
- [ ] Vercel 프리뷰 배포 테스트 후에만 프로덕션 전환

## 5. 현재 운영 범위

광고, 유료 작품, 작가 현금정산, 오리지널 IP 계약은 구현하지 않았습니다. 수익화·실서비스 공개 전에 사업·계약·개인정보·콘텐츠 신고 대응 조건을 별도 검토해야 합니다.
