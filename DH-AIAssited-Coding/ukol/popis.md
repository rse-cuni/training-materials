# Úkol: AI-asistované programování

Zprovozněte si libovolného programovacího asistenta a vytvořte jednoduchou aplikaci, podobně jako v ukázce z přednášky. Může to být i stejná aplikace nebo jakákoliv jiná, která je blízká vaší doméně nebo problému, který řešíte.

## Návod

V přiloženém videu je návod, jak zprovoznit AI asistenta **pi-agent** (open source obdoba Claude Code) a jeho napojení na modely od e-infra.

> Pokud budete potřebovat poradit, napište mi.

## Odevzdání

Pro splnění úkolu mi stačí zaslat krátké video s ukázkou aplikace.

## Odkazy a příkazy z videa

```powershell
# 1. Instalace Node.js
# https://nodejs.org/en/download

# 2. Povolit spouštění skriptů (Windows)
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned

# 3. Ověřit instalaci npm
npm --version

# 4. Nainstalovat pi-agent
npm install -g @mariozechner/pi-coding-agent

# 5. Instalace Git (Windows)
# https://git-scm.com/download/win

# 6. Spustit pi-agent s modelem od e-infra
pi --model einfra/kimi-k2.6
```

> **Poznámka:** Soubor `models.json` slouží k nastavení pi-agent — viz video.

## Video

[Odkaz na video s návodem](https://cunicz-my.sharepoint.com/:v:/g/personal/11342192_cuni_cz/IQAg14tcCqwqQbewAOjVOghAATekIqPXShAXIHY3W-x2Hh4?nav=eyJyZWZlcnJhbEluZm8iOnsicmVmZXJyYWxBcHAiOiJPbmVEcml2ZUZvckJ1c2luZXNzIiwicmVmZXJyYWxBcHBQbGF0Zm9ybSI6IldlYiIsInJlZmVycmFsTW9kZSI6InZpZXciLCJyZWZlcnJhbFZpZXciOiJNeUZpbGVzTGlua0NvcHkifX0&e=ECboqM)