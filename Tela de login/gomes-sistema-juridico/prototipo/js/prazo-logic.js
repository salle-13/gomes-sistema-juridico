// Lógica de datas e prazos (CPC arts. 219, 220 e 224). Usada pela página e testada em Node.
const Prazo = (() => {
  const pad = n => String(n).padStart(2, '0');
  const ymd = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const parse = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return ymd(d); };

  function pascoa(ano) {
    const a = ano % 19, b = Math.floor(ano / 100), c = ano % 100, d = Math.floor(b / 4), e = b % 4;
    const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
    const mes = Math.floor((h + l - 7 * m + 114) / 31), dia = ((h + l - 7 * m + 114) % 31) + 1;
    return ymd(new Date(ano, mes - 1, dia));
  }

  let locais = []; // [{data:'YYYY-MM-DD', nome}]
  const cache = new Map();
  function setLocais(lista) { locais = Array.isArray(lista) ? lista : []; cache.clear(); }

  function feriadosAno(ano) {
    if (cache.has(ano)) return cache.get(ano);
    const m = new Map();
    const fixos = [
      ['01-01', 'Confraternização Universal'], ['04-21', 'Tiradentes'], ['05-01', 'Dia do Trabalho'],
      ['09-07', 'Independência'], ['10-12', 'Nossa Senhora Aparecida'], ['11-02', 'Finados'],
      ['11-15', 'Proclamação da República'], ['11-20', 'Consciência Negra'],
      ['12-08', 'Dia da Justiça (forense)'], ['12-25', 'Natal'],
    ];
    fixos.forEach(([md, nome]) => m.set(ano + '-' + md, nome));
    const p = pascoa(ano);
    m.set(addDays(p, -48), 'Carnaval');
    m.set(addDays(p, -47), 'Carnaval');
    m.set(addDays(p, -2), 'Sexta-feira Santa');
    m.set(addDays(p, 60), 'Corpus Christi');
    locais.filter(f => f && f.data && f.data.startsWith(ano + '-')).forEach(f => m.set(f.data, f.nome + ' (local)'));
    cache.set(ano, m);
    return m;
  }
  const feriado = s => feriadosAno(Number(s.slice(0, 4))).get(s) || null;
  const recesso = s => { const md = s.slice(5); return md >= '12-20' || md <= '01-20'; };
  const fimDeSemana = s => { const w = parse(s).getDay(); return w === 0 || w === 6; };
  const diaUtil = s => !fimDeSemana(s) && !feriado(s) && !recesso(s);
  const proximoUtil = s => { let d = s; while (!diaUtil(d)) d = addDays(d, 1); return d; };

  // Vencimento a partir da data de publicação. O prazo começa no 1º dia útil seguinte (CPC 224 §3).
  function vencimento(publicacao, dias, contagem) {
    dias = Math.max(1, Number(dias) || 0);
    if (contagem === 'corridos') {
      const inicio = proximoUtil(addDays(publicacao, 1));
      return proximoUtil(addDays(inicio, dias - 1));
    }
    let d = publicacao, n = 0;
    while (n < dias) { d = addDays(d, 1); if (diaUtil(d)) n++; }
    return d;
  }
  // Dias úteis em (a, b]
  function uteisEntre(a, b) {
    if (b <= a) return 0;
    let d = a, n = 0;
    while (d < b) { d = addDays(d, 1); if (diaUtil(d)) n++; }
    return n;
  }
  function voltarUteis(s, n) { let d = s, k = 0; while (k < n) { d = addDays(d, -1); if (diaUtil(d)) k++; } return d; }

  function situacao(p, hoje, antecedencia) {
    if (p.status === 'concluido') return 'concluido';
    if (!p.vencimento) return 'ok';
    if (p.vencimento < hoje) return 'vencido';
    if (p.vencimento === hoje) return 'hoje';
    const u = uteisEntre(hoje, p.vencimento);
    if (u <= 2) return 'critico';
    if (u <= antecedencia) return 'atencao';
    return 'ok';
  }
  return { ymd, parse, addDays, pascoa, feriadosAno, feriado, recesso, fimDeSemana, diaUtil, proximoUtil, vencimento, uteisEntre, voltarUteis, situacao, setLocais };
})();
if (typeof module !== 'undefined') module.exports = Prazo;
