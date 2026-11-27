# Podsumowanie — dzień 1, 23 listopada 2026

## O czym był pierwszy dzień

Pierwszy dzień pięciodniowego szkolenia JSystems „AI dla programistów — od pomysłu do MVP” połączył wprowadzenie do narzędzi AI dla programistów z ćwiczeniami praktycznymi. Głównym narzędziem szkolenia jest Claude Code. Wśród alternatyw i narzędzi z szerszego ekosystemu pojawiły się OpenAI Codex CLI, GitHub Copilot i Copilot CLI.

Początek spotkania zajął dostęp do środowisk szkoleniowych i logowanie do Claude. Omawiano między innymi typowe trudności z RDP, dostępem przez przeglądarkę, linkami logowania i schowkiem w środowisku wirtualnym. Następnie przedstawiono repozytorium kursu, krajobraz narzędzi AI, podstawy porównywania modeli oraz pracę z Claude Code.

## Modele, agenci i kryteria wyboru

Agent programistyczny może korzystać z narzędzi, wykonywać wieloetapowe zadania i pracować na plikach projektu. Zakres jego działania zależy od konfiguracji i uprawnień, dlatego wynik oraz wykonywane operacje należy sprawdzać — szczególnie przed uruchomieniem wygenerowanego kodu lub skryptu. Omówiono też pojęcia takie jak model, kontekst, orkiestracja i model wykonawczy.

Do orientowania się w możliwościach modeli przedstawiono rankingi Arena.ai dla agentów, programowania i zadań biurowych oraz agregator Artificial Analysis. Przykłady modeli i rodzin modeli obejmowały Claude Opus, Sonnet i Haiku, modele open-weight, Qwen oraz Inkling-2-Mini i Inkling-2-Small od Thinking Machines. W materiałach i rozmowie pojawiły się również Bielik oraz modele MiMo, Kimi i GLM. Rankingi warto traktować jako pomoc w wyborze i punkt wyjścia do własnych prób na zadaniach podobnych do tych, które chce się rozwiązać — nie jako stały, uniwersalny werdykt.

Inkling-2-Small i Inkling-2-Mini to obecnie najmocniejsze amerykańskie modele open-weight; Thinking Machines kieruje Mira Murati, była CTO OpenAI. Najlepsze modele do self-hostingu (np. Qwen i Inkling-2-Mini) wymagają około 32 GB VRAM albo dużej pamięci współdzielonej, np. w komputerach Mac. Bielik to polski model językowy, a MiMo, Kimi, GLM i Qwen są ciekawymi, tańszymi alternatywami z Chin. Artificial Analysis pozwala też porównać poziomy myślenia (reasoning) z jakością i ceną.

Wskazano, że przy wyborze modelu znaczenie mają nie tylko wyniki, lecz także koszt, szybkość i rodzaj zadania. Warto rozróżniać model planujący lub koordynujący pracę od modelu wykonującego konkretne zadania. Szczegółowe porównanie Claude z Codex i Copilotem pozostawiono na kolejny dzień.

W przeglądzie historii i ekosystemu narzędzi pojawiły się Tabnine (jedno z pierwszych narzędzi do podpowiadania kodu), CrewAI (jeden z pierwszych frameworków do zespołów agentów AI) i Cursor (IDE agentowe). Omarchy, dystrybucja Linuksa rozwijana przez bardzo mały zespół, posłużyła jako przykład tego, ile mogą dziś zbudować niewielkie zespoły wspierane przez AI.

Trzy pojęcia, które będą wracać przez cały kurs:

- **Vibe Coding** — termin Andreja Karpathy'ego: opisujemy agentowi, **co** ma powstać, i akceptujemy wynik bez szczegółowej analizy kodu. Dobre do prototypów i eksperymentów.
- **Vibe Engineering** — praca z agentami z inżynierską dyscypliną: specyfikacja, testy, review i kontrola zmian.
- **AI Slop** — treść lub kod, który od razu wygląda na wygenerowany przez AI, bez dopracowania i weryfikacji.

## Krótkie ćwiczenie z Vibe Coding

Ćwiczenie polegało na wymyśleniu aplikacji lub gry — na przykład inspirowanej dzieciństwem albo ulubionym bohaterem — i opisaniu przede wszystkim **co** ma powstać, a nie **jak** to zaimplementować. Pomysły można było wypróbować w Arena.ai, gdzie dwa modele lub agenty rozwiązują to samo zadanie i można porównać ich wyniki. Wynikami podzielimy się na początku dnia 2.

## Repozytorium i pierwsze kroki z Claude Code

Przedstawiono repozytorium kursu i pokazano sposób sklonowania go na maszynę wirtualną oraz rozpoczęcia pracy w nowej gałęzi:

```bash
git clone https://github.com/LucasMatuszewski/jsystems-ai-programming-2026-11.git
cd jsystems-ai-programming-2026-11
git switch -c feat/moja-aplikacja
claude
```

Folder roboczy widoczny na górze sesji powinien wskazywać `~/jsystems-ai-programming-2026-11`. Przydatne skróty i polecenia:

- `!` — shell mode, czyli uruchomienie polecenia powłoki bez wychodzenia z Claude Code (np. `! git clone ...`),
- `/cd <path>` — zmiana katalogu z wygodną wyszukiwarką; alternatywnie `! cd <path>`,
- `Esc` — wyjście z widoków, `Ctrl+C` — zamknięcie Claude Code,
- `claude update` — aktualizacja (u trenera z `v2.1.299` do `v2.1.330`), a po restarcie `claude --continue` wznawia poprzednią sesję. Pokazano też Remote Control (`/rc`): lokalną sesję Claude Code można kontynuować z innych urządzeń — przez [claude.ai/code](https://claude.ai/code), aplikację mobilną lub desktopową.

Materiały kursowe obejmują indeks pojęć, narzędzi, dokumentacji i badań. W rozmowie udostępniono również dokumentację bezpieczeństwa Claude Code. W praktyce warto przyjąć zasadę najmniejszych potrzebnych uprawnień i przed zatwierdzeniem działania sprawdzić, co agent zamierza zrobić.

## Zadania cykliczne, tokeny i język pracy

Pokazano zadanie zaplanowane (Schedule) uruchamiane codziennie około 6:00. Poza samą treścią ma ono praktyczny cel: rozpoczyna 5-godzinne okno limitu użycia jeszcze przed pracą, więc limit odnawia się wcześniej w ciągu dnia. Przykładowy prompt:

> Research the news in the AI world, LLM models, and GPU graphics cards, and tell me a joke that covers these events in a humorous, slightly cheeky, ironic, and sarcastic way. Send me these news stories every morning to improve my humor.

Rano w dniu 2 sprawdzimy, czy zadanie się uruchomiło.

Omówiono tokenizację: model przetwarza tekst jako sekwencje tokenów, a nie po prostu jako słowa czy litery. Wielkość kontekstu ogranicza ilość informacji, które model może uwzględnić naraz. Różnica w liczbie tokenów między polskim i angielskim zależy od tekstu oraz tokenizera; dlatego nie należy traktować jednej stałej proporcji jako reguły. OpenAI Tokenizer pozwala zobaczyć, jak przykładowy tekst jest dzielony na tokeny. Angielski może być praktyczny przy pracy z anglojęzycznym kodem i dokumentacją, ale można wybrać język najlepiej pasujący do zadania i zespołu.

Strony statusowe dostawców pokazują stabilność i dostępność usług — warto je sprawdzić, zanim zaczniemy szukać błędu u siebie.

Handy to bezpłatne narzędzie open source do dyktowania poleceń i dowolnego tekstu, z możliwością post-processingu transkrypcji promptem. Canary 1B v2 to według trenera najlepszy model rozpoznawania mowy dla polskiego oraz angielskiego z polskim akcentem.

## Materiały i linki

- [Materiały szkoleniowe](https://devpowers.com/szkolenia/jsystems/ai-programming-2026-11/)
- [Repozytorium kursu](https://github.com/LucasMatuszewski/jsystems-ai-programming-2026-11)
- [Indeks kursu: pojęcia, narzędzia, dokumentacja i badania](https://github.com/LucasMatuszewski/jsystems-ai-programming-2026-11/blob/main/course-materials/Course%20INDEX%20-%20AI%20in%20Programming.md)
- [Osoby i konta polecane do śledzenia](https://github.com/LucasMatuszewski/jsystems-ai-programming-2026-11/blob/main/course-materials/Course%20INDEX%20-%20AI%20in%20Programming.md#people-and-accounts-to-follow-in-ai)
- [Dokumentacja bezpieczeństwa Claude Code](https://code.claude.com/docs/en/security)
- [Slajd z instrukcją startu](https://devpowers.com/szkolenia/jsystems/ai-programming-2026-11/Prezentacja_01_Start_kursu.html#9)
- [Arena.ai](https://arena.ai/), [ranking agentów](https://arena.ai/leaderboard/agent), [ranking programowania](https://arena.ai/leaderboard/code/webdev), [ranking zadań biurowych](https://arena.ai/leaderboard/agent/work) i [ranking modeli open-weight do programowania](https://arena.ai/leaderboard/code/webdev?license=open-source)
- [Artificial Analysis](https://artificialanalysis.ai/), [indeks inteligencji](https://artificialanalysis.ai/#intelligence) i [porównanie poziomu myślenia, jakości i ceny](https://artificialanalysis.ai/#intelligence-efficiency-tabs)
- Przykłady modeli: [Bielik](https://www.bielik.ai/), [MiMo](https://artificialanalysis.ai/models/mimo-v2-6-pro), [Kimi](https://artificialanalysis.ai/models/kimi-k3-1-pro), [GLM](https://artificialanalysis.ai/models/glm-5-3), [Qwen](https://artificialanalysis.ai/models/qwen4-max), [Inkling-2-Small](https://artificialanalysis.ai/models/inkling-2-small), [Inkling-2-Mini na Hugging Face](https://huggingface.co/thinkingmachines/Inkling-2-Mini), [Qwen na Arena.ai](https://arena.ai/leaderboard/code/webdev/models/qwen3.8-27b-ebux) i [Inkling na Arena.ai](https://arena.ai/leaderboard/code/webdev/models/inkling-2-mini-ez3a)
- [Vibe Coding — wpis Andreja Karpathy’ego](https://x.com/karpathy/status/1886192184808149383?lang=en), [Andrej Karpathy](https://x.com/karpathy) i [Mira Murati](https://x.com/miramurati)
- [Tabnine](https://docs.tabnine.com/main), [CrewAI](https://crewai.com/), [Omarchy](https://omarchy.org/) i [Cursor](https://cursor.com/)
- [GitHub Copilot CLI](https://github.com/github/copilot-cli)
- [Status OpenAI](https://status.openai.com/) i [status Claude](https://status.claude.com/)
- [OpenAI Tokenizer](https://platform.openai.com/tokenizer)
- [Handy](https://handy.computer/), [przykładowe prompty do transkrypcji Handy](https://github.com/LucasMatuszewski/jsystems-ai-programming-2026-11/blob/main/course-materials/Prompt%20examples/Handy.computer%20-%20transcription%20prompts.md) i [repozytorium Handy](https://github.com/cjpais/Handy)
- [Artykuł o badaniu dotyczącym języka polskiego i LLM](https://cryps.pl/sztuczna-inteligencja-mowi-po-polsku-nasz-jezyk-zdeklasowal-angielski-w-najnowszym-rankingu/)

## Plan na dzień 2

- Sprawdzić, czy poranne zadanie uruchomiło się około 6:00 i czy 5-godzinne okno limitu już trwa.
- Podzielić się wynikami aplikacji lub gier z Arena.ai.
- Skonfigurować statusline — skryptem trenera albo własną konfiguracją przez `/statusline`.
- Omówić zmiany na rynku pracy, potrzebne kompetencje i przykłady zastosowań.
- Zainstalować Skills i pierwsze CLI, w tym Playwright; następnie przejść do design systems. Opcjonalnie: Playwright extension i Chrome DevTools CLI Debug Mode.
- Dodać Context7 przez MCP/CLI oraz omówić connectory w Claude Web/Cloud i różnice między lokalnym MCP a CLI.
- Omówić instrukcje `AGENTS.md` i `CLAUDE.md`, workflow oraz `/init` (i dlaczego trener go nie używa).
- Dodać personalizacje na poziomie użytkownika (lokalnie), czatu (w chmurze) i projektu (w repozytorium).
- Rozpocząć pracę nad PRD i ADR, a jeśli wystarczy czasu — także nad planem aplikacji.
- Jeśli wystarczy czasu, porównać Claude z Codex i Copilot CLI/extensions.
