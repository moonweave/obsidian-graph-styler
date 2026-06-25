# 🎨 Graph Styler

옵시디언 그래프 뷰를 **클릭 한 번으로** 예쁘게. 무드 하나 고르면 **색·글로우·forces**가 즉시 입혀집니다. CSS도, JSON도, 설정도 필요 없어요.

만든 사람 **[Moonweave](https://www.instagram.com/phd.ai.log/)**.

<!-- ![스크린샷](docs/preview.png) — 추가 예정 -->

## 왜
옵시디언 그래프는 스크린샷이 정말 예쁘게 나오죠 — 근데 그렇게 만들려면 색 그룹, forces 슬라이더, CSS 스니펫을 다 뒤져야 합니다. Graph Styler는 그걸 클릭 한 번으로. *그래프계 Canva 템플릿*이라고 보면 됩니다.

## 프리셋
⚡ Neon · 🌌 Galaxy · 🌠 Aurora · 🌅 Sunset · 🌴 Vaporwave · 🌊 Ocean · 🌲 Forest · 🍬 Candy · ✨ Gold · 👾 Cyberpunk · ⚪ Mono

각 프리셋이 노드/그룹 색 + 글로우 CSS + 무드에 맞춘 forces·크기 값을 한꺼번에 적용합니다.

## 사용법
1. 그래프 뷰(전역 그래프)를 엽니다.
2. 왼쪽 리본의 🎨 **팔레트** 아이콘 클릭 → 오른쪽에 패널이 뜹니다.
3. 프리셋을 누르면 그래프가 즉시 바뀝니다.
4. 이후 자유롭게 조정하거나, **↩︎ 되돌리기**로 원상복구 — 원래 `graph.json`은 자동 백업됩니다.

## 설치
**BRAT으로 (지금):**
1. 커뮤니티 플러그인 *BRAT* 설치
2. BRAT → "Add beta plugin" → `moonweave/obsidian-graph-styler`
3. 커뮤니티 플러그인에서 **Graph Styler** 켜기

**수동:** `main.js` + `manifest.json`을 `<vault>/.obsidian/plugins/graph-styler/`에 복사 후 켜기.

*(공식 스토어 등재 예정.)*

## 참고
- 전역 그래프 설정(`.obsidian/graph.json`)과 CSS 스니펫(`.obsidian/snippets/graph-styler-*.css`)을 씁니다.
- 색 그룹은 현재 폴더 기준이며, 어떤 vault에서도 되도록 태그/폴더 자동감지를 추가할 예정입니다.
- 데스크탑 전용.

## 라이선스
MIT © 2026 Moonweave. 자유롭게 쓰고 수정하되, 저작권 표시는 유지해주세요.

🇬🇧 [English](README.md)
