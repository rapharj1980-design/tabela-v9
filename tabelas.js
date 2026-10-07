document.querySelectorAll(".produto-row").forEach((row) => {
  let timer;
  let isReading = false;

  // Função para processar texto e substituir "/" por pausa
  const processarTexto = (texto) => {
    return texto.replace(/\//g, ", ");
  };

  // Função para ler o conteúdo da linha
  const lerLinha = () => {
    if (isReading) return; // Evita leituras sobrepostas

    const colunas = row.querySelectorAll("td");
    const produto = processarTexto(colunas[0].innerText);
    const preco = processarTexto(colunas[1].innerText);
    const textoParaLer = `${produto}, custa ${preco}`;

    // Configuração da síntese de voz
    const msg = new SpeechSynthesisUtterance(textoParaLer);
    msg.lang = "pt-BR";
    msg.rate = 1;

    // Efeito visual de destaque
    row.classList.add("highlight");

    msg.onstart = () => {
      isReading = true;
    };
    msg.onend = () => {
      isReading = false;
      row.classList.remove("highlight");
    };

    window.speechSynthesis.speak(msg);
  };

  // Evento de clique imediato
  row.addEventListener("click", () => {
    window.speechSynthesis.cancel(); // Para leituras atuais antes de reiniciar
    lerLinha();
  });

  // Eventos de Mouse (Timer de 2 segundos)
  row.addEventListener("mouseenter", () => {
    timer = setTimeout(() => {
      lerLinha();
    }, 2000); // 2000ms = 2 segundos
  });

  row.addEventListener("mouseleave", () => {
    clearTimeout(timer); // Cancela o timer se o mouse sair antes de 2s
    row.classList.remove("highlight");
  });
});
