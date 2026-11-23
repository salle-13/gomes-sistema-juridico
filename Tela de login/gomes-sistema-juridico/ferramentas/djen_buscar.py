#!/usr/bin/env python3
"""Busca publicações na API pública do DJEN (comunicaapi.pje.jus.br) por OAB e período.

Uso:
    python ferramentas/djen_buscar.py --oab MG181253 --de 2026-11-09 --ate 2026-11-22
    python ferramentas/djen_buscar.py --oab MG181253,MG123456 --de 2026-11-01 --ate 2026-11-30

Gera importacao-projuris/djen-<OAB>-<de>-a-<ate>.json no formato
{"status": "success", "count": N, "items": [...]}, pronto para o botão
"Importar" do módulo Publicações. Essa pasta é ignorada pelo Git (dados reais).

Só usa a biblioteca padrão do Python 3.
"""

import argparse
import json
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import Counter
from datetime import date
from pathlib import Path

API = "https://comunicaapi.pje.jus.br/api/v1/comunicacao"
ITENS_POR_PAGINA = 100
PAUSA_ENTRE_PAGINAS = 2      # segundos
ESPERA_429 = 60              # segundos
MAX_TENTATIVAS_429 = 3
RAIZ = Path(__file__).resolve().parent.parent
PASTA_SAIDA = RAIZ / "importacao-projuris"


def ler_oab(texto):
    """Aceita 'MG181253', 'MG 181.253', '181253MG' ou '181253/MG'. Devolve (uf, numero)."""
    t = texto.strip().upper()
    letras = re.sub(r"[^A-Z]", "", t)
    numero = re.sub(r"\D", "", t)
    if len(letras) != 2 or not numero:
        raise ValueError(f"OAB inválida: {texto!r} (use, por exemplo, MG181253)")
    return letras, numero.lstrip("0") or "0"


def ler_data(texto):
    try:
        return date.fromisoformat(texto).isoformat()
    except ValueError:
        raise argparse.ArgumentTypeError(f"data inválida: {texto!r} (use AAAA-MM-DD)")


def buscar_pagina(uf, numero, de, ate, pagina):
    """Busca uma página. Em caso de 429, espera 60 s e tenta de novo (até 3 vezes)."""
    params = urllib.parse.urlencode({
        "numeroOab": numero,
        "ufOab": uf,
        "dataDisponibilizacaoInicio": de,
        "dataDisponibilizacaoFim": ate,
        "itensPorPagina": ITENS_POR_PAGINA,
        "pagina": pagina,
    })
    req = urllib.request.Request(f"{API}?{params}", headers={
        "Accept": "application/json",
        "User-Agent": "djen-buscar/1.0 (python-urllib)",
    })
    tentativas_429 = 0
    while True:
        try:
            with urllib.request.urlopen(req, timeout=60) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            if e.code == 429 and tentativas_429 < MAX_TENTATIVAS_429:
                tentativas_429 += 1
                print(f"  Limite de consultas (429). Esperando {ESPERA_429} s "
                      f"(tentativa {tentativas_429} de {MAX_TENTATIVAS_429})...", flush=True)
                time.sleep(ESPERA_429)
                continue
            raise RuntimeError(f"o DJEN respondeu com erro {e.code} na página {pagina}") from e
        except urllib.error.URLError as e:
            raise RuntimeError(f"falha de conexão com o DJEN: {e.reason}") from e


def buscar_oab(uf, numero, de, ate):
    """Busca todas as páginas de uma OAB até completar o 'count'. Devolve (count, itens)."""
    itens, pagina, total = [], 1, None
    while True:
        if pagina > 1:
            time.sleep(PAUSA_ENTRE_PAGINAS)
        dados = buscar_pagina(uf, numero, de, ate, pagina)
        if dados.get("status") not in (None, "success"):
            raise RuntimeError(f"resposta inesperada do DJEN: {dados.get('message') or dados.get('status')}")
        lote = dados.get("items") or []
        total = int(dados.get("count") or 0)
        itens.extend(lote)
        print(f"  {uf}{numero}: página {pagina}: {len(lote)} item(ns) "
              f"({len(itens)} de {total})", flush=True)
        if not lote or len(itens) >= total:
            break
        pagina += 1
    return total, itens


def main():
    ap = argparse.ArgumentParser(description="Busca publicações no DJEN por OAB e período.")
    ap.add_argument("--oab", required=True, help="OAB(s) separadas por vírgula, ex.: MG181253,MG123456")
    ap.add_argument("--de", required=True, type=ler_data, help="data inicial (AAAA-MM-DD)")
    ap.add_argument("--ate", required=True, type=ler_data, help="data final (AAAA-MM-DD)")
    args = ap.parse_args()

    if args.de > args.ate:
        ap.error("a data inicial (--de) é posterior à final (--ate)")
    try:
        oabs = [ler_oab(o) for o in args.oab.split(",") if o.strip()]
    except ValueError as e:
        ap.error(str(e))
    if not oabs:
        ap.error("informe ao menos uma OAB")

    total_encontrado = 0
    por_id = {}
    for uf, numero in oabs:
        print(f"Buscando OAB {uf}{numero} de {args.de} a {args.ate}...", flush=True)
        try:
            count, itens = buscar_oab(uf, numero, args.de, args.ate)
        except RuntimeError as e:
            print(f"Erro ao buscar {uf}{numero}: {e}", file=sys.stderr)
            return 1
        total_encontrado += count
        for it in itens:
            chave = it.get("id")
            if chave is None:  # sem id: usa o hash ou o próprio conteúdo como chave
                chave = it.get("hash") or json.dumps(it, sort_keys=True, ensure_ascii=False)
            por_id.setdefault(chave, it)

    itens = sorted(por_id.values(), key=lambda i: (str(i.get("data_disponibilizacao") or ""), str(i.get("id") or "")))
    nome_oab = "_".join(f"{uf}{num}" for uf, num in oabs)
    PASTA_SAIDA.mkdir(exist_ok=True)
    saida = PASTA_SAIDA / f"djen-{nome_oab}-{args.de}-a-{args.ate}.json"
    with open(saida, "w", encoding="utf-8") as f:
        json.dump({"status": "success", "count": len(itens), "items": itens}, f, ensure_ascii=False, indent=1)

    por_tribunal = Counter(i.get("siglaTribunal") or "(sem tribunal)" for i in itens)
    por_dia = Counter(str(i.get("data_disponibilizacao") or "(sem data)")[:10] for i in itens)

    print()
    print("=" * 50)
    print(f"Total encontrado no DJEN: {total_encontrado}")
    print(f"Total salvo (sem repetições): {len(itens)}")
    print(f"Arquivo: {saida.relative_to(RAIZ)}")
    print("\nPor tribunal:")
    for trib, n in sorted(por_tribunal.items(), key=lambda x: (-x[1], x[0])):
        print(f"  {trib:<12} {n:>5}")
    print("\nPor dia:")
    for dia, n in sorted(por_dia.items()):
        print(f"  {dia}  {n:>5}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
