# 🎨 Graph Styler

옵시디언 그래프 뷰를 **클릭 한 번으로** 예쁘게. 무드 하나 고르면 **색·글로우·forces**가 즉시 입혀집니다. CSS도, JSON도, 설정도 필요 없어요.

만든 사람 **[Moonweave](https://www.instagram.com/phd.ai.log/)**.

![Graph Styler](docs/preview.png)
<!-- docs/preview.png 를 실제 그래프 스크린샷으로 언제든 교체 가능. -->

## 왜
옵시디언 그래프는 스크린샷이 정말 예쁘게 나오죠 — 근데 그렇게 만들려면 색 그룹, forces 슬라이더, CSS 스니펫을 다 뒤져야 합니다. Graph Styler는 그걸 클릭 한 번으로. *그래프계 Canva 템플릿*이라고 보면 됩니다.

## 프리셋
⚡ Neon · 🌌 Galaxy · 🌠 Aurora · 🌅 Sunset · 🌴 Vaporwave · 🌊 Ocean · 🌲 Forest · 🍬 Candy · ✨ Gold · 👾 Cyberpunk · ❄️ Nord · 🧛 Dracula · 🐈 Catppuccin · ⚪ Mono

각 프리셋이 노드/그룹 색 + 글로우 CSS + 무드에 맞춘 forces·크기 값을 한꺼번에 적용합니다.

**내 프리셋 만들기.** 패널의 **🎛️ 커스터마이즈**를 열어 forces·크기 슬라이더(반발력, 링크 거리, 노드 크기…)를 끌고 색을 고르면 그래프가 라이브로 바뀝니다. **💾 내 프리셋으로 저장**하면 *내 프리셋* 목록에 남습니다.

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
- **어떤 vault에서도 동작.** 그룹 색이 *내* vault에서 노트가 가장 많은 폴더에 자동 매핑됩니다 — 설정도, 하드코딩 경로도 없음.
- **양국어 UI.** 패널이 옵시디언 언어를 따라갑니다 — 영어 또는 한국어.
- 전역 그래프 설정(`.obsidian/graph.json`)과 CSS 스니펫(`.obsidian/snippets/graph-styler-*.css`)을 쓰며, 원래 `graph.json`은 먼저 백업합니다.
- 데스크탑 전용.

## 라이선스
MIT © 2026 Moonweave. 자유롭게 쓰고 수정하되, 저작권 표시는 유지해주세요.

🇬🇧 [English](README.md)
