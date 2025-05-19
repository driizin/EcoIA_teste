let currentChatId = null;
let toggleMenuBtn;
let historyArea;
let base64ImageFromPaste = null;

document.addEventListener("DOMContentLoaded", () => {
  appendMessage(
    "Olá meu caro usuário! Eu sou o EcoIA, a IA que te auxiliará em assuntos sobre ecologia. Qual é a sua dúvida?",
    "bot_message"
  );

  let isMenuFixed = false;
  let isHoveringMenu = false;
  let timeoutId;
  let menuOpen = false;

  toggleMenuBtn = document.getElementById("toggleMenuBtn");
  historyArea = document.getElementById("historyArea");

  function updateMenuButtonTooltip() {
    if (menuOpen) {
      if (isMenuFixed) {
        toggleMenuBtn.title = "Fechar menu";
      } else {
        toggleMenuBtn.title = "Manter menu aberto";
      }
    } else {
      toggleMenuBtn.title = "Abrir menu";
    }
  }

  toggleMenuBtn.addEventListener("mouseenter", () => {
    updateMenuButtonTooltip();
  });

  function openMenu() {
    if (!menuOpen) {
      historyArea.classList.remove("closed");
      menuOpen = true;
      updateMenuButtonTooltip();
    }
  }

  function closeMenu() {
    if (menuOpen) {
      historyArea.classList.add("closed");
      menuOpen = false;
      updateMenuButtonTooltip();
    }
  }

  toggleMenuBtn.addEventListener("click", () => {
    if (isMenuFixed) {
      isMenuFixed = false;
      closeMenu();
    } else {
      isMenuFixed = true;
      openMenu();
    }
  });

  historyArea.addEventListener("mouseenter", () => {
    isHoveringMenu = true;
    if (!isMenuFixed) {
      clearTimeout(timeoutId);
      openMenu();
    }
  });

  historyArea.addEventListener("mouseleave", () => {
    isHoveringMenu = false;
    if (!isMenuFixed) {
      timeoutId = setTimeout(closeMenu, 200);
    }
  });

  updateMenuButtonTooltip();
  closeMenu();
  loadConversationHistory();

  const inputArea = document.querySelector(".input-area");
  const imageInput = document.getElementById("imageInput");
  const imagePreviewContainer = document.getElementById(
    "imagePreviewContainer"
  );
  const userInput = document.getElementById("userInput");
  const chatBox = document.getElementById("chatBox"); // Obtém a chatBox aqui
  const imageUploadIcon = document.querySelector(".image-upload-icon");

  if (imageUploadIcon) {
    imageUploadIcon.addEventListener("click", () => {
      imageInput.click();
    });
  }

  imageInput.addEventListener("change", (event) => {
    const file = event.target.files[0];
    const inputArea = document.querySelector(".input-area");
    const previewContainer = document.getElementById("imagePreviewContainer");

    if (file) {
      displayImagePreview(file);
      inputArea.classList.add("has-image"); // Adicionamos esta linha aqui
    } else {
      // Se nenhum arquivo for selecionado (por exemplo, se o usuário cancelar),
      // removemos a classe para garantir que a altura volte ao normal.
      inputArea.classList.remove("has-image");
      // Adicionando a lógica para remover o container de prévia
      if (previewContainer && previewContainer.parentNode === inputArea) {
        inputArea.removeChild(previewContainer);
      }
    }
  });

  userInput.addEventListener("paste", (event) => {
    const items = (event.clipboardData || event.originalEvent.clipboardData)
      .items;
    let imagePasted = false; // Variável para controlar se uma imagem foi colada
    const inputArea = document.querySelector(".input-area");
    const previewContainer = document.getElementById("imagePreviewContainer");

    // Cria o container se ele não existir
    if (!imagePreviewContainer) {
      imagePreviewContainer = document.createElement("div");
      imagePreviewContainer.id = "imagePreviewContainer";
      inputArea.appendChild(imagePreviewContainer);
    }

    for (const item of items) {
      if (item.type.startsWith("image/")) {
        const blob = item.getAsFile();

        const reader = new FileReader();
        reader.onload = (e) => {
          const base64 = e.target.result;

          // Mostra a prévia com botão de exclusão (usando canvas)
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement("canvas");
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext("2d");
            ctx.drawImage(img, 0, 0);
            const imageUrl = canvas.toDataURL("image/png");

            const previewDiv = document.createElement("div");
            previewDiv.style.position = "relative";
            previewDiv.style.display = "inline-block";
            previewDiv.style.marginRight = "5px";

            const previewImg = document.createElement("img");
            previewImg.src = imageUrl;
            previewImg.alt = "Prévia da imagem";
            previewImg.style.maxWidth = "70px";
            previewImg.style.height = "auto";

            const removeButton = document.createElement("button");
            removeButton.classList.add("remove-image-button");
            removeButton.innerHTML = `
            <svg version="1.0" xmlns="http://www.w3.org/2000/svg"
              width="16pt" height="16pt" viewBox="0 0 559.000000 447.000000"
              preserveAspectRatio="xMidYMid meet" fill="currentColor">
            <g transform="translate(0.000000,447.000000) scale(0.100000,-0.100000)"
            fill="currentColor" stroke="none">
            <path d="M2150 3162 c-38 -20 -80 -89 -80 -132 1 -14 6 -37 13 -52 7 -14 269
            -285 583 -602 499 -502 577 -576 613 -586 98 -26 192 46 191 147 -1 21 -6 48
            -13 59 -22 40 -1131 1154 -1163 1169 -43 20 -102 19 -144 -3z"/>
            <path d="M3312 3165 c-18 -8 -133 -114 -254 -235 l-222 -221 107 -107 107
            -107 221 220 c121 121 227 232 235 247 34 65 6 158 -61 195 -46 26 -86 28
            -133 8z"/>
            <path d="M2303 2218 c-232 -234 -243 -250 -228 -319 12 -52 69 -107 120 -115
            82 -12 103 2 328 226 114 114 207 211 207 216 0 5 -47 55 -103 112 l-102 102
            -222 -222z"/>
            </g>
            </svg>
          `;
            removeButton.onclick = function () {
              previewDiv.remove();
              base64ImageFromPaste = null; // Limpa corretamente ao remover
              // Remove o container de prévia se não houver mais imagens
              if (!imagePreviewContainer.querySelector("img")) {
                inputArea.removeChild(imagePreviewContainer);
              }
              // Se não houver mais imagens, remove a classe 'has-image'
              if (!inputArea.querySelector("#imagePreviewContainer div")) {
                inputArea.classList.remove("has-image");
              }
            };

            previewDiv.appendChild(previewImg);
            previewDiv.appendChild(removeButton);
            imagePreviewContainer.innerHTML = "";
            imagePreviewContainer.appendChild(previewDiv);

            // Armazene a string base64 para enviar (a do canvas)
            base64ImageFromPaste = imageUrl;
          };
          img.src = base64;
        };
        reader.readAsDataURL(blob);

        imagePasted = true; // Marcamos que uma imagem foi colada
        inputArea.classList.add("has-image"); // Adicionamos esta linha aqui
        event.preventDefault(); // Importante para evitar o comportamento padrão de colar
        break; // Já encontramos uma imagem, podemos sair do loop
      }
    }
    // Se nada que se pareça com uma imagem foi colado, removemos a classe e o container.
    if (!imagePasted) {
      inputArea.classList.remove("has-image");
      // Adicionando a lógica para remover o container de prévia
      if (previewContainer && previewContainer.parentNode === inputArea) {
        inputArea.removeChild(previewContainer);
      }
    }
  });
});

function displayImagePreview(file) {
  const inputArea = document.querySelector(".input-area");
  let imagePreviewContainer = document.getElementById("imagePreviewContainer");

  // Cria o container se ele não existir
  if (!imagePreviewContainer) {
    imagePreviewContainer = document.createElement("div");
    imagePreviewContainer.id = "imagePreviewContainer";
    inputArea.appendChild(imagePreviewContainer);
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    const imageUrl = e.target.result;
    const previewDiv = document.createElement("div");
    previewDiv.style.position = "relative";
    previewDiv.style.display = "inline-block";
    previewDiv.style.marginRight = "5px";

    const img = document.createElement("img");
    img.src = imageUrl;
    img.alt = "Prévia da imagem";
    img.style.maxWidth = "50px";
    img.style.height = "auto";

    const removeButton = document.createElement("button");
    removeButton.classList.add("remove-image-button");
    removeButton.innerHTML = `
      <svg version="1.0" xmlns="http://www.w3.org/2000/svg"
        width="16pt" height="16pt" viewBox="0 0 559.000000 447.000000"
        preserveAspectRatio="xMidYMid meet" fill="currentColor">
      <g transform="translate(0.000000,447.000000) scale(0.100000,-0.100000)"
      fill="currentColor" stroke="none">
      <path d="M2150 3162 c-38 -20 -80 -89 -80 -132 1 -14 6 -37 13 -52 7 -14 269
      -285 583 -602 499 -502 577 -576 613 -586 98 -26 192 46 191 147 -1 21 -6 48
      -13 59 -22 40 -1131 1154 -1163 1169 -43 20 -102 19 -144 -3z"/>
      <path d="M3312 3165 c-18 -8 -133 -114 -254 -235 l-222 -221 107 -107 107
      -107 221 220 c121 121 227 232 235 247 34 65 6 158 -61 195 -46 26 -86 28
      -133 8z"/>
      <path d="M2303 2218 c-232 -234 -243 -250 -228 -319 12 -52 69 -107 120 -115
      82 -12 103 2 328 226 114 114 207 211 207 216 0 5 -47 55 -103 112 l-102 102
      -222 -222z"/>
      </g>
      </svg>
    `;
    removeButton.onclick = function () {
      previewDiv.remove();
      document.getElementById("imageInput").value = "";
      base64ImageFromPaste = null;
      // Remove o container de prévia se não houver mais imagens
      if (!imagePreviewContainer.querySelector("img")) {
        inputArea.removeChild(imagePreviewContainer);
      }
      // Se não houver mais imagens, remove a classe 'has-image'
      if (!inputArea.querySelector("#imagePreviewContainer div")) {
        inputArea.classList.remove("has-image");
      }
    };

    previewDiv.appendChild(img);
    previewDiv.appendChild(removeButton);
    imagePreviewContainer.appendChild(previewDiv);
  };
  reader.readAsDataURL(file);
}

//Função de carregar conversa salva
function loadConversationHistory() {
  fetch("/api/history")
    .then((res) => res.json())
    .then((history) => {
      const historyBox = document.getElementById("historyBox");
      historyBox.innerHTML = "";
      const initialCount = Math.min(history.length, 5);
      let allConversationsVisible = initialCount >= history.length;

      for (let i = 0; i < initialCount; i++) {
        addConversationToHistory(history[i]);
      }

      if (history.length > 5) {
        // Adicionamos esta condição
        const showMoreButton = document.createElement("button");
        showMoreButton.textContent = "Mostrar mais";
        showMoreButton.classList.add("show-more-btn");

        showMoreButton.addEventListener("click", () => {
          if (!allConversationsVisible) {
            for (let i = initialCount; i < history.length; i++) {
              addConversationToHistory(history[i]);
            }
            showMoreButton.textContent = "Mostrar menos";
            allConversationsVisible = true;
          } else {
            historyBox.innerHTML = "";
            for (let i = 0; i < initialCount; i++) {
              addConversationToHistory(history[i]);
            }
            showMoreButton.textContent = "Mostrar mais";
            allConversationsVisible = false;

            if (history.length > initialCount) {
              historyBox.appendChild(showMoreButton);
            }
          }
        });
        historyBox.appendChild(showMoreButton);
      }
    });
}

//Salvar a conversa
function addConversationToHistory(conversation) {
  const div = document.createElement("div");
  div.classList.add("conversation-item");
  div.dataset.conversationId = conversation.id;

  const title = document.createElement("span");
  title.textContent = conversation.title || "Nova Conversa";
  title.classList.add("conversation-title");
  title.onclick = function () {
    currentChatId = conversation.id;
    loadChatForConversation(currentChatId);
    document
      .querySelectorAll(".conversation-item")
      .forEach((item) => item.classList.remove("selected"));
    div.classList.add("selected");
  };

  //Botão de adicionar conversa
  const optionsButton = document.createElement("button");
  optionsButton.innerHTML = "&#8942;";
  optionsButton.className = "options-btn";
  optionsButton.onclick = (event) => {
    event.stopPropagation();
    toggleOptions(conversation.id, optionsButton);
  };

  //Botão de opções
  const optionsMenu = document.createElement("div");
  optionsMenu.className = "options-menu";
  optionsMenu.dataset.conversationId = conversation.id;

  //Botão de renomear a convesa
  const renameOption = document.createElement("button");
  renameOption.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16" style="vertical-align: middle; margin-right: 6px;">
        <path d="M15.502 1.94a.5.5 0 0 1 0 .706l-1.793 1.793-2-2L13.502.646a.5.5 0 0 1 .707 0l1.293 1.293zm-2.853 2.853-2-2L3 11.44V14h2.56l7.089-7.207z"/>
      </svg>
      Renomear`;
  renameOption.onclick = () =>
    showRenameModal(conversation.id, conversation.title);
  renameOption.classList.add("option-item");

  //Botão de renomear a convesa
  const deleteOption = document.createElement("button");
  deleteOption.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16" style="vertical-align: middle; margin-right: 6px;">
        <path d="M5.5 5.5a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0v-6a.5.5 0 0 1 .5-.5zm5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0v-6a.5.5 0 0 1 .5-.5z"/>
        <path d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1 0-2H5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1h2.5a1 1 0 0 1 1 1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3a.5.5 0 0 0 0 1H13.5a.5.5 0 0 0 0-1H2.5z"/>
      </svg>
      Excluir`;
  deleteOption.onclick = () => deleteConversation(conversation.id);
  deleteOption.classList.add("option-item");

  optionsMenu.appendChild(renameOption);
  optionsMenu.appendChild(deleteOption);

  div.appendChild(title);
  div.appendChild(optionsButton);
  div.appendChild(optionsMenu);

  document.getElementById("historyBox").appendChild(div);
}

function toggleOptions(conversationId, button) {
  const menu = document.querySelector(
    `.options-menu[data-conversation-id="${conversationId}"]`
  );
  if (menu) {
    menu.classList.toggle("show");
    document.querySelectorAll(".options-menu.show").forEach((otherMenu) => {
      if (otherMenu !== menu) {
        otherMenu.classList.remove("show");
      }
    });
  }
}

window.addEventListener("click", (event) => {
  if (
    !event.target.matches(".options-btn") &&
    !event.target.matches(".options-menu button")
  ) {
    document.querySelectorAll(".options-menu.show").forEach((menu) => {
      menu.classList.remove("show");
    });
  }
});

//Iniciar uma conversa
function startNewConversation() {
  currentChatId = null;
  document.getElementById("chatBox").innerHTML = "";
  appendMessage(
    "Olá meu caro usuário! Eu sou o EcoIA, a IA que te auxiliará em assuntos sobre ecologia. Qual é a sua dúvida?",
    "bot_message"
  );
}

//Renomar conversa salva
function showRenameModal(id, currentTitle) {
  const modal = document.getElementById("renameConversationModal");
  const titleInput = document.getElementById("newConversationTitle");
  const confirmButton = document.getElementById("confirmRename");
  const cancelButton = document.getElementById("cancelRename");

  titleInput.value = currentTitle || "";
  modal.style.display = "block";

  confirmButton.onclick = () => {
    const newTitle = titleInput.value.trim();
    if (newTitle) {
      renameConversation(id, newTitle);
      modal.style.display = "none";
      confirmButton.onclick = null;
    } else {
      alert("Por favor, insira um novo título.");
    }
  };

  cancelButton.onclick = () => {
    modal.style.display = "none";
    confirmButton.onclick = null;
  };

  window.onclick = (event) => {
    if (event.target == modal) {
      modal.style.display = "none";
      confirmButton.onclick = null;
    }
  };
}

function renameConversation(id, newTitle) {
  fetch(`/api/conversations/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title: newTitle }),
  }).then(loadConversationHistory);
}

//Remover conversa salva
function deleteConversation(id) {
  const modal = document.getElementById("deleteConfirmationModal");
  const confirmButton = document.getElementById("confirmDelete");
  const cancelButton = document.getElementById("cancelDelete");
  const modalTitle = modal.querySelector(".modal-title");
  const modalMessage = modal.querySelector(".modal-message");

  modalTitle.textContent = "Excluir bate-papo?";
  modalMessage.textContent =
    "Você não vai ver mais esta conversa aqui. Essa ação também vai excluir atividades relacionadas a ecologia";

  modal.style.display = "block";

  confirmButton.onclick = () => {
    fetch(`/api/conversations/${id}`, { method: "DELETE" }).then(() => {
      if (currentChatId == id) {
        currentChatId = null;
        document.getElementById("chatBox").innerHTML = "";
      }
      loadConversationHistory();
      modal.style.display = "none";
    });
  };

  cancelButton.onclick = () => {
    modal.style.display = "none";
  };

  window.onclick = (event) => {
    if (event.target == modal) {
      modal.style.display = "none";
    }
  };
}

// Função que insere mensagem com texto e/ou imagem
function appendMessageWithImage(text, imageData, className) {
  const chatBox = document.getElementById("chatBox");
  const messageElement = document.createElement("div");
  messageElement.className = `message ${className}`;

  if (text && text.trim() !== "") {
    const textContainer = document.createElement("div");
    textContainer.className = "message-text-container";
    textContainer.innerHTML = `<p class="message-text">${text}</p>`;
    messageElement.appendChild(textContainer);
  }

  if (imageData && imageData.trim() !== "") {
    const imageContainer = document.createElement("div");
    imageContainer.className = "message-image-container";
    imageContainer.innerHTML = `<img src="${imageData}" alt="Imagem enviada" class="message-image">`;
    messageElement.appendChild(imageContainer);
  }

  chatBox.appendChild(messageElement);
  chatBox.scrollTop = chatBox.scrollHeight;
}

// Carregar área do chatbot
function loadChatForConversation(conversationId) {
  const chatBox = document.getElementById("chatBox");
  chatBox.innerHTML = "";

  fetch(`/api/conversations/${conversationId}`)
    .then((res) => res.json())
    .then((messages) => {
      messages.forEach((msg) => {
        const messageClass = msg.image_data
          ? msg.sender === "user"
            ? "user_image"
            : "bot_image"
          : msg.sender === "user"
          ? "user_message"
          : "bot_message";

        if (msg.sender === "bot" && !msg.image_data) {
          // Convertemos Markdown da Gemini para HTML
          const html = marked.parse(msg.text);
          appendMessageWithImage(html, null, "bot_message");
        } else {
          appendMessageWithImage(msg.text, msg.image_data, messageClass);
        }
      });
    });
}

// Função de mandar mensagem como usuário
function sendMessage() {
  const input = document.getElementById("userInput");
  const message = input.value.trim();
  const imageFile = document.getElementById("imageInput").files[0];
  const imagePreviewSrc = document.querySelector(
    "#imagePreviewContainer img"
  )?.src;

  let base64ImageFromFile = null;

  const sendData = () => {
    const dataToSend = { message: message, conversation_id: currentChatId };
    if (base64ImageFromFile) {
      dataToSend.image = base64ImageFromFile;
      console.log("Enviando (Upload): ", {
        message: dataToSend.message,
        conversation_id: dataToSend.conversation_id,
        image: dataToSend.image
          ? dataToSend.image.substring(0, 50) + "..."
          : null,
      });
    } else if (base64ImageFromPaste) {
      dataToSend.image = base64ImageFromPaste;
      console.log("Enviando (Paste): ", {
        message: dataToSend.message,
        conversation_id: dataToSend.conversation_id,
        image: dataToSend.image
          ? dataToSend.image.substring(0, 50) + "..."
          : null,
      });
    } else {
      console.log("Enviando (Texto apenas): ", {
        message: dataToSend.message,
        conversation_id: dataToSend.conversation_id,
      });
    }

    fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dataToSend),
    })
      .then((res) => res.json())
      .then((data) => {
        appendMessage(data.response, "bot_message", data.bot_message_id);
        if (!currentChatId && data.conversation_id) {
          currentChatId = data.conversation_id;
          loadConversationHistory();
        }
      })
      .finally(() => {
        // Adicionado o bloco finally para garantir a remoção da classe
        const inputArea = document.querySelector(".input-area");
        inputArea.classList.remove("has-image");
      });
  };

  if (message === "" && !imageFile && !imagePreviewSrc) return;

  if (message !== "") {
    appendMessage(message, "user_message");
  }

  if (imageFile) {
    const reader = new FileReader();
    reader.onloadend = () => {
      base64ImageFromFile = reader.result;
      appendMessageWithImage(
        "", // O texto da mensagem pode ser vazio se for apenas imagem
        base64ImageFromFile,
        "user_image"
      );
      document.getElementById("imageInput").value = "";
      sendData();
    };
    reader.readAsDataURL(imageFile);
  } else if (imagePreviewSrc && imagePreviewSrc.startsWith("data:image/")) {
    appendMessageWithImage(
      "", // O texto da mensagem pode ser vazio se for apenas imagem
      base64ImageFromPaste,
      "user_image"
    );
    document.getElementById("imageInput").value = "";
    sendData();
  } else {
    sendData();
  }

  // Sempre limpa os campos
  input.value = "";
  const imagePreviewContainer = document.getElementById(
    "imagePreviewContainer"
  );
  if (imagePreviewContainer) {
    imagePreviewContainer.innerHTML = "";
  }
  const inputArea = document.querySelector(".input-area");
  inputArea.classList.remove("has-image"); // Garante que a classe seja removida aqui também
}

function sendCorrection(feedbackType, messageId, correctionText) {
  const data = {
    feedback_type: feedbackType,
    message_id: messageId,
    correction_text: correctionText,
  };

  fetch("/api/feedback", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  })
    .then((response) => response.json())
    .then((data) => {
      console.log("Correção enviada:", data);
      // Atualizar a interface do usuário, se necessário
    })
    .catch((error) => {
      console.error("Erro ao enviar correção:", error);
    });
}

// Função de exibir imagem no chat
function appendMessage(text, className, messageId) {
  const chatBox = document.getElementById("chatBox");
  const msgDiv = document.createElement("div");
  msgDiv.className = `message ${className}`;

  // Converte Markdown para HTML se for resposta do bot e adiciona feedback
  if (className === "bot_message" && messageId) {
    const htmlContent = marked.parse(text);
    msgDiv.innerHTML = `<div class="message-text">${htmlContent}</div>`;

    const feedbackDiv = document.createElement("div");
    feedbackDiv.className = "feedback-area";

    const likeButton = document.createElement("button");
    likeButton.className = "feedback-button";
    likeButton.innerHTML = `
  <svg version="1.0" xmlns="http://www.w3.org/2000/svg"
    width="404.000000pt" height="618.000000pt" viewBox="0 0 404.000000 618.000000"
    preserveAspectRatio="xMidYMid meet" style="width: 24px; height: 36px;">
    <g transform="translate(0.000000,618.000000) scale(0.100000,-0.100000)"
      fill="none" stroke="currentColor" stroke-width="20" stroke-linecap="round" stroke-linejoin="round">
      <path d="M2550 4852 c-160 -61 -238 -172 -256 -362 -9 -90 -32 -122 -176 -237
      -162 -130 -228 -192 -273 -258 -21 -30 -41 -55 -45 -55 -3 0 -31 13 -61 29
      -81 44 -145 54 -310 49 -136 -3 -147 -5 -210 -35 -109 -51 -184 -141 -215
      -258 -20 -72 -20 -1204 0 -1286 18 -77 54 -136 121 -197 88 -81 139 -96 325
      -97 99 0 174 5 207 13 44 12 121 55 189 107 9 6 20 3 36 -11 31 -28 83 -57
      154 -85 l59 -24 574 -3 c338 -2 600 1 636 7 228 35 370 229 331 451 l-14 75
      31 65 c37 80 46 180 24 253 -15 47 -15 49 15 107 36 70 47 167 29 260 -11 56
      -11 64 8 96 32 54 54 152 47 209 -12 101 -45 171 -112 238 -98 99 -163 117
      -436 117 -231 0 -219 -4 -193 71 21 58 45 224 45 301 -1 195 -103 379 -248
      449 -64 31 -216 37 -282 11z m182 -182 c30 0 94 -67 118 -123 42 -96 37 -298
      -11 -420 -30 -75 -91 -158 -171 -231 l-72 -66 409 0 c409 0 410 0 460 -24 58
      -27 78 -47 100 -99 42 -100 -16 -216 -125 -248 l-39 -12 38 -19 c105 -52 127
      -197 44 -283 -19 -20 -52 -43 -74 -52 l-39 -15 39 -28 c81 -59 107 -161 59
      -239 -28 -46 -41 -57 -103 -85 -47 -22 -48 -24 -25 -31 58 -17 110 -97 110
      -170 0 -50 -33 -108 -83 -149 l-39 -31 -611 0 -612 0 -43 23 c-99 53 -162 136
      -181 237 -18 95 -14 866 4 989 30 197 117 322 355 506 183 142 244 232 253
      375 7 118 50 176 147 196 19 4 44 5 55 3 11 -2 28 -4 37 -4z m-1107 -864 c56
      -26 88 -57 104 -99 7 -19 11 -228 11 -629 0 -667 3 -640 -68 -697 -43 -36 -79
      -43 -210 -42 -139 0 -167 7 -209 49 -70 70 -67 41 -64 700 3 633 3 632 53 679
      50 47 105 63 223 63 95 0 117 -3 160 -24z"/>
    </g>
  </svg>
`;
    likeButton.onclick = () => sendFeedback("positivo", messageId);

    const dislikeButton = document.createElement("button");
    dislikeButton.className = "feedback-button negative-feedback"; // Adicionei classe para estilo
    dislikeButton.innerHTML = `
    <svg version="1.0" xmlns="http://www.w3.org/2000/svg"
        width="408.000000pt" height="612.000000pt" viewBox="0 0 408.000000 612.000000"
        preserveAspectRatio="xMidYMid meet" style="width: 24px; height: 36px;">
        <g transform="translate(0.000000,612.000000) scale(0.100000,-0.100000)"
            fill="none" stroke="currentColor" stroke-width="20" stroke-linecap="round" stroke-linejoin="round">
            <path d="M772 3990 c-200 -41 -344 -271 -288 -462 l16 -55 -32 -59 c-27 -50
            -33 -71 -36 -144 -2 -54 1 -99 10 -125 13 -38 12 -43 -16 -94 -34 -63 -45
            -167 -28 -260 9 -50 8 -58 -21 -120 -70 -148 -24 -342 106 -443 101 -79 139
            -88 400 -88 202 0 207 0 207 -21 0 -11 -5 -30 -11 -41 -18 -33 -49 -226 -49
            -302 1 -195 101 -377 246 -446 53 -26 73 -30 146 -30 121 0 193 26 271 99 67
            62 116 187 117 297 0 62 46 115 220 251 107 83 167 142 224 218 21 28 40 52
            41 53 2 2 30 -10 62 -26 32 -17 76 -36 98 -41 59 -16 300 -14 362 3 111 30
            223 133 260 241 16 46 18 105 18 675 l0 625 -24 64 c-18 47 -40 80 -80 121
            -99 99 -182 124 -395 118 -171 -5 -225 -23 -318 -107 l-27 -24 -53 36 c-29 20
            -82 49 -118 64 l-65 28 -600 2 c-330 1 -619 -3 -643 -7z m1176 -194 c67 -4
            122 -30 180 -86 98 -95 107 -156 99 -710 -8 -489 -13 -530 -92 -664 -48 -82
            -100 -136 -267 -272 -201 -165 -245 -229 -257 -372 -9 -100 -27 -142 -74 -171
            -75 -46 -167 -39 -226 17 -79 76 -104 224 -67 399 25 123 67 196 171 300 l93
            93 -409 0 c-396 0 -411 1 -451 21 -78 40 -108 88 -108 174 0 45 5 63 26 91 34
            44 78 75 118 84 l31 6 -37 18 c-77 37 -118 147 -85 226 21 47 73 95 121 110
            l40 13 -37 18 c-59 31 -87 82 -87 159 0 47 5 73 19 94 23 35 96 86 123 86 29
            0 21 15 -17 33 -53 25 -88 86 -88 151 0 67 23 110 82 151 l43 30 491 5 c475 5
            540 4 665 -4z m857 -16 c53 -25 80 -62 94 -128 16 -74 15 -1105 -1 -1170 -15
            -65 -41 -98 -99 -128 -45 -22 -61 -25 -170 -25 -112 0 -123 2 -170 28 -35 19
            -59 41 -77 72 l-27 46 0 595 c0 560 1 597 18 629 21 38 62 79 92 92 11 4 83 8
            159 8 120 1 146 -2 181 -19z"/>
        </g>
    </svg>
`;
    dislikeButton.onclick = () => showCorrectionModal(messageId);

    feedbackDiv.appendChild(likeButton);
    feedbackDiv.appendChild(dislikeButton);
    msgDiv.appendChild(feedbackDiv);

    // Adicionar o campo de correção inicialmente escondido
    const correctionInputArea = document.createElement("div");
    correctionInputArea.id = `correctionInput_${messageId}`;
    correctionInputArea.style.display = "none";
    correctionInputArea.style.marginTop = "5px";

    const correctionTextarea = document.createElement("textarea");
    correctionTextarea.placeholder = "Qual seria a resposta correta?";
    correctionTextarea.style.width = "100%";
    correctionTextarea.style.marginBottom = "5px";

    const sendCorrectionButton = document.createElement("button");
    sendCorrectionButton.textContent = "Enviar Correção";
    sendCorrectionButton.onclick = () => {
      sendCorrection(
        "negativo_com_correcao",
        messageId,
        correctionTextarea.value
      );
      correctionInputArea.style.display = "none"; // Esconde após o envio
      feedbackDiv.style.display = "flex"; // Mostra os botões de feedback novamente
    };

    correctionInputArea.appendChild(correctionTextarea);
    correctionInputArea.appendChild(sendCorrectionButton);
    msgDiv.appendChild(correctionInputArea);
  } else {
    msgDiv.innerHTML = `<p class="message-text">${text}</p>`;
  }

  chatBox.appendChild(msgDiv);
  chatBox.scrollTop = chatBox.scrollHeight;
}

// Envio com Enter
document.getElementById("userInput").addEventListener("keyup", (e) => {
  if (e.key === "Enter") sendMessage();
});

function showCorrectionModal(messageId) {
  const modal = document.getElementById("correctionModal");
  const textarea = document.getElementById("correctionText");
  const cancelBtn = document.getElementById("cancelCorrection");
  const submitBtn = document.getElementById("submitCorrection");

  textarea.value = "";
  modal.style.display = "block";

  cancelBtn.onclick = () => {
    modal.style.display = "none";
  };

  submitBtn.onclick = () => {
    const correctionText = textarea.value.trim();
    if (!correctionText) return alert("Por favor, escreva a correção.");

    sendCorrection("negativo_com_correcao", messageId, correctionText);
    modal.style.display = "none";
  };

  window.onclick = (event) => {
    if (event.target == modal) {
      modal.style.display = "none";
    }
  };
}

function sendFeedback(feedbackType, messageId) {
  fetch("/api/feedback", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message_id: messageId,
      feedback_type: feedbackType,
      conversation_id: currentChatId, // Certifique-se de que currentChatId esteja definido corretamente
    }),
  })
    .then((response) => response.json())
    .then((data) => {
      console.log("Feedback enviado:", data);
      // Opcional: Adicionar algum feedback visual para o usuário
    })
    .catch((error) => {
      console.error("Erro ao enviar feedback:", error);
      // Opcional: Mostrar uma mensagem de erro para o usuário
    });
}
