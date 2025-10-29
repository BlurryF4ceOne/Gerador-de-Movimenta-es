// ===================== Utilidades ===========================
function formatCurrency(value) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function getTodayStr() {
  const today = new Date();
  return today.toLocaleDateString('pt-BR');
}

// ===================== Dados Globais ========================
const categorias = [
  { nome: "Xerox", peso: 0.5 },
  { nome: "Impressão WhatsApp", peso: 0.3 },
  { nome: "Impressão Internet", peso: 0.2 }
];
let movimentacoes = [];
let historico = {};
let dataAtual = getTodayStr();

// ===================== LocalStorage =========================
function salvarDia(data, movs) {
  historico[data] = movs;
  localStorage.setItem("movimentacoesLojaAlves", JSON.stringify(historico));
}
function carregarHistorico() {
  const h = localStorage.getItem("movimentacoesLojaAlves");
  historico = h ? JSON.parse(h) : {};
}
function salvarDiaAtual() {
  salvarDia(dataAtual, movimentacoes);
}

// ===================== Movimentações ========================
// Gera valores entre 0,50 e 20,00, sempre múltiplos de 0,50, com mais chance de valores baixos, mas permitindo grandes!
function gerarMovimentacoes(valorTotal, qtd) {
  const min = 0.5;
  const max = 20.0;
  let valoresPossiveis = [];
  for (let v = min; v <= max; v += 0.5) {
    valoresPossiveis.push(Number(v.toFixed(2)));
  }

  // Probabilidade: valores menores são mais comuns, mas valores grandes podem aparecer
  // Exemplo: peso = 1/(valor^0.7), ajusta a curva
  const pesos = valoresPossiveis.map(v => 1 / Math.pow(v, 0.7));
  const somaPesos = pesos.reduce((a, b) => a + b, 0);
  const probs = pesos.map(p => p / somaPesos);

  let valores = [];
  let restante = Math.round(valorTotal * 100) / 100;
  for (let i = 0; i < qtd; i++) {
    // Calcula possíveis para esta posição
    let maxVal = Math.min(max, restante - min * (qtd - i - 1));
    let minVal = Math.max(min, restante - max * (qtd - i - 1));
    let disponiveis = valoresPossiveis.filter(v => v >= minVal && v <= maxVal && v <= restante);
    let probsDisp = disponiveis.map(v => probs[valoresPossiveis.indexOf(v)]);
    // Normaliza as probabilidades dos disponíveis
    let somaP = probsDisp.reduce((a,b)=>a+b,0);
    probsDisp = probsDisp.map(p => p/somaP);

    // Sorteia valor pelo peso
    let valor;
    if (i === qtd - 1) {
      // Último: fecha certinho
      let ultimo = Math.round(restante * 2) / 2;
      if (disponiveis.includes(ultimo)) valor = ultimo;
      else valor = disponiveis[disponiveis.length - 1] || min;
    } else {
      let sorteio = Math.random();
      let acumulado = 0;
      for (let j = 0; j < disponiveis.length; j++) {
        acumulado += probsDisp[j];
        if (sorteio <= acumulado) {
          valor = disponiveis[j];
          break;
        }
      }
      // fallback
      if (!valor) valor = disponiveis[0];
    }
    valores.push(valor);
    restante -= valor;
    restante = Math.round(restante * 100) / 100;
  }
  const cats = gerarCategorias(qtd);
  return valores.map((v, i) => ({
    valor: v,
    categoria: cats[i],
    descricao: cats[i]
  }));
}

function gerarCategorias(qtd) {
  // Gera array de categorias conforme proporções
  const arr = [];
  categorias.forEach(cat => {
    const n = Math.round(qtd * cat.peso);
    for (let i = 0; i < n; i++) arr.push(cat.nome);
  });
  // Preenche se faltou ou sobrou
  while (arr.length < qtd) arr.push(categorias[0].nome); // preenche com a principal
  while (arr.length > qtd) arr.pop();
  // Embaralha
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ===================== DOM e Renderização ===================
function renderMovimentacoes() {
  const list = document.getElementById("movimentacoesList");
  list.innerHTML = "";
  let total = 0;
  movimentacoes.forEach((mov, idx) => {
    total += mov.valor;
    list.innerHTML += `
      <div class="flex items-center bg-white dark:bg-gray-800 rounded shadow p-3 transition">
        <div class="flex-1">
          <span class="font-semibold text-blue-700 dark:text-blue-300">${formatCurrency(mov.valor)}</span>
          <input
            type="text"
            value="${mov.descricao}"
            class="ml-2 px-2 py-1 rounded border bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-200"
            onchange="window.atualizarDescricao(${idx}, this.value)"
            title="Editar descrição"
          />
        </div>
        <button onclick="window.removerMovimentacao(${idx})" title="Remover" class="ml-2 px-2 py-1 rounded bg-red-500 hover:bg-red-600 text-white">
          <i class="fas fa-trash"></i>
        </button>
      </div>
    `;
  });
  document.getElementById("totalOfDay").textContent = total.toFixed(2);
  renderStats();
  salvarDiaAtual();
}

function renderStats() {
  const stats = document.getElementById("statsPanel");
  if (movimentacoes.length === 0) return stats.innerHTML = "";
  // Estatísticas
  const total = movimentacoes.reduce((sum, m) => sum + m.valor, 0);
  const porTipo = {};
  movimentacoes.forEach(m => {
    porTipo[m.categoria] = (porTipo[m.categoria] || { qtd: 0, valor: 0 });
    porTipo[m.categoria].qtd += 1;
    porTipo[m.categoria].valor += m.valor;
  });
  let statsHtml = `<div class="bg-gray-50 dark:bg-gray-700 p-3 rounded">
    <strong>Estatísticas:</strong><br>
    Movimentações: <b>${movimentacoes.length}</b><br>
    Média por serviço: <b>${formatCurrency(total / movimentacoes.length)}</b><br>
    <ul class="mt-2">`;
  Object.keys(porTipo).forEach(cat => {
    statsHtml += `<li>${cat}: ${porTipo[cat].qtd} (${((porTipo[cat].qtd / movimentacoes.length) * 100).toFixed(0)}%) - ${formatCurrency(porTipo[cat].valor)}</li>`;
  });
  statsHtml += `</ul></div>`;
  stats.innerHTML = statsHtml;
}

function renderHistorico() {
  const hist = document.getElementById("historicoList");
  hist.innerHTML = "";
  Object.keys(historico).sort((a,b) => b.localeCompare(a)).forEach(data => {
    const total = historico[data].reduce((sum,m) => sum+m.valor,0);
    hist.innerHTML += `
      <div class="bg-gray-100 dark:bg-gray-800 p-2 rounded flex items-center justify-between">
        <span><b>${data}:</b> ${historico[data].length} movs — ${formatCurrency(total)}</span>
        <button class="px-2 py-1 bg-blue-500 text-white rounded" onclick="window.carregarDia('${data}')">Abrir</button>
        <button class="px-2 py-1 bg-red-400 text-white rounded ml-2" onclick="window.excluirDia('${data}')">Excluir</button>
      </div>
    `;
  });
}

// ===================== Ações JS <-> HTML ====================
window.removerMovimentacao = function(idx) {
  if (confirm("Remover movimentação?")) {
    movimentacoes.splice(idx, 1);
    renderMovimentacoes();
  }
}
window.atualizarDescricao = function(idx, texto) {
  movimentacoes[idx].descricao = texto;
  movimentacoes[idx].categoria = texto; // Mantém categoria igual à descrição editada
  salvarDiaAtual();
}

window.carregarDia = function(data) {
  dataAtual = data;
  movimentacoes = historico[dataAtual] ? JSON.parse(JSON.stringify(historico[dataAtual])) : [];
  renderMovimentacoes();
  document.getElementById("currentDate").textContent = dataAtual;
}

window.excluirDia = function(data) {
  if (confirm("Excluir todo o registro desse dia?")) {
    delete historico[data];
    localStorage.setItem("movimentacoesLojaAlves", JSON.stringify(historico));
    if (dataAtual === data) {
      movimentacoes = [];
      renderMovimentacoes();
    }
    renderHistorico();
  }
}

// ===================== Relatório/Exportação =================
function gerarRelatorioTexto() {
  let texto = `Relatório - Loja Alves\nData: ${dataAtual}\nTotal: ${formatCurrency(movimentacoes.reduce((s,m)=>s+m.valor,0))}\n\n`;
  movimentacoes.forEach((m, i) => {
    texto += `${i+1}. ${formatCurrency(m.valor)} – ${m.descricao}\n`;
  });
  texto += `\nRelatório gerado automaticamente – Sistema de Movimentações da Loja Alves.`;
  return texto;
}
document.getElementById("btnCopiarRelatorio").onclick = function() {
  navigator.clipboard.writeText(gerarRelatorioTexto());
  alert("Relatório copiado!");
};
document.getElementById("btnExportarPDF").onclick = function() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  doc.setFont("helvetica");
  doc.setFontSize(14);
  doc.text(`Loja Alves - Relatório de Movimentações`, 15, 15);
  doc.setFontSize(12);
  doc.text(`Data: ${dataAtual}`, 15, 25);
  doc.text(`Total: ${formatCurrency(movimentacoes.reduce((s,m)=>s+m.valor,0))}`, 15, 32);
  let linha = 40;
  movimentacoes.forEach((m, i) => {
    doc.text(`${i+1}. ${formatCurrency(m.valor)} – ${m.descricao}`, 15, linha);
    linha += 8;
    if (linha > 270) { doc.addPage(); linha = 20; }
  });
  doc.text(`Relatório gerado automaticamente – Sistema de Movimentações da Loja Alves.`, 15, linha+8);
  doc.save(`relatorio_loja_alves_${dataAtual.replace(/\//g,"-")}.pdf`);
};

// ===================== Inicialização ========================
function init() {
  carregarHistorico();
  if (!historico[dataAtual]) {
    movimentacoes = [];
    salvarDiaAtual();
  } else {
    movimentacoes = JSON.parse(JSON.stringify(historico[dataAtual]));
  }
  document.getElementById("currentDate").textContent = dataAtual;
  renderMovimentacoes();
  renderHistorico();
  // Alternância tema
  document.getElementById("toggleTheme").onclick = function() {
    document.body.classList.toggle("dark");
    localStorage.setItem("themeMovLojaAlves", document.body.classList.contains("dark") ? "dark" : "light");
  };
  // Carrega tema salvo
  if (localStorage.getItem("themeMovLojaAlves") === "dark") {
    document.body.classList.add("dark");
  }
  // Geração
  document.getElementById("btnGerar").onclick = function() {
    const valor = parseFloat(document.getElementById("valorTotal").value.replace(",","."));
    const qtdMov = parseInt(document.getElementById("qtdMov").value);
    if (isNaN(valor) || valor <= 0 || isNaN(qtdMov) || qtdMov < 1) return alert("Preencha os campos corretamente!");
    // Garante que o valor total é múltiplo de 0,50
    if ((Math.round(valor * 2) / 2) !== valor) {
      alert("O valor total deve ser múltiplo de 0,50!");
      return;
    }
    movimentacoes = gerarMovimentacoes(valor, qtdMov);
    salvarDiaAtual();
    renderMovimentacoes();
  };
  // Novo Dia
  document.getElementById("btnNovoDia").onclick = function() {
    if (confirm("Iniciar novo dia? Isso vai limpar as movimentações atuais.")) {
      dataAtual = getTodayStr();
      movimentacoes = [];
      salvarDiaAtual();
      document.getElementById("currentDate").textContent = dataAtual;
      renderMovimentacoes();
      renderHistorico();
    }
  };
}
init();