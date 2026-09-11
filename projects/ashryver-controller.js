/**
 * Contains JavaScript fetching logic to hook up predictions from the Ashryver model's HuggingFace space to this Quarto site.
 * Also contains the functionality for outputting brief information about each of the 20 artists, and recommended reading links,
 * upon prediction.
 */

// TODO: Would like to be able to allow users to share this embed using custom code. That's one of the main reasons why this custom UI was designed, aside from making it simpler and more minimalistic than HF.

const artistInfo = {
  "van gogh": "A Dutch Post-Impressionist (1853-1890) known for bold color and expressive brushwork, famous for his painting Starry Night. Learn more link",
  "monet": "A French Impressionist (1840-1926), best known for his water lily series and his quick, loose brushstrokes that blend from a distance.",
  "warhol": "An American artist and filmmaker (1928-1987) whose work explores the relationship between advertising, consumerism, mass media, and celebrity culture.",
  "renoir": "A French Impressionist (1841-1919) whose work is famous for capturing vibrant light, joyful social crowds, and soft feminine beauty.",
  "degas": "(1834-1917) A French Impressionist artist celebrated for his images of Parisian life. However, he preferred to classify himself as a Realist.",
  "morisot": "(1841-1895) A leading French painter known for her loose, rapid brushstrokes and luminous use of light.",
  "cassatt": "(1844-1926) An American painter and printmaker known for her tender, realistic portrayals of the social and private lives of women.",
  "cezanne": "(1839-1906) A French post-Impressionist painter known for his revolutionary approach to form, color, and perspective.",
  "gauguin": "(1848-1903) A French Post-Impressionist painter known for bold, flat areas of color and thick outlines.",
  "manet": "(1832-1883) A French painter who bridged the gap between Realism and Impressionism, known for painting everyday contemporary life with bold brushwork.",
  "pissarro": "(1830-1903) - a Danish-French painter and printmaker known for depictions of Rural French landscapes and village life.",
  "matisse": "(1869-1954) - a French master who led the Fauvism movement and known for radical non-naturalistic color and expressive flat planes.",
  "turner": "(1775-1851) - a pioneering English Romantic painter, printmaker, and watercolorist renowned for his expressive treatment of light and atmospheric weather.",
  "braque": "(1882-1963) - a foundational 20th-century French painter and sculptor known for meditative still lifes and textured tactile surfaces.",
  "mondrian": "(1872-1944) - a famous Dutch painter who helped invent 20th-century abstract art, best known for his simple geometric paintings.",
  "seurat": "A pioneering French painter (1859-1891) who founded the Neo-Impressionism movement, and the inventor of Pointillism and Divionism.",
  "rivera": "A world-famous Mexican muralist and painter (1886-1957) who defined Mexican modern art through bold, monumental wall frescoes.",
  "whistler": "An American-born painter (1834-1903), printmaker, and theorist active mainly in London and Paris. Champion of the 'art for art's sake' aesthetic movement.",
};

document.addEventListener("DOMContentLoaded", () => {
  let currentImageBase64 = null; // set by upload, drag-drop, or example click; read by classifyBtn

  const artInput = document.getElementById("artInput");
  const dropZone = document.getElementById("dropZone");
  const preview = document.getElementById("imagePreview");
  const clearBtn = document.getElementById("clearBtn");

  function setImage(base64) {
    currentImageBase64 = base64;
    preview.src = base64;
    preview.style.display = "block";
    clearBtn.style.display = "inline-block";
  }

  function handleFile(file) {
    if (!file) return;
    fileToBase64(file).then(setImage);
  }

  artInput.addEventListener("change", () => {
    handleFile(artInput.files[0]);
  });

  dropZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropZone.classList.add("dragover");
  });

  dropZone.addEventListener("dragleave", () => {
    dropZone.classList.remove("dragover");
  });

  dropZone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropZone.classList.remove("dragover");
    const file = e.dataTransfer.files[0];
    if (!file) return;
    const dt = new DataTransfer();
    dt.items.add(file);
    artInput.files = dt.files;
    handleFile(file);
  });

  document.querySelectorAll(".example-thumb").forEach((thumb) => {
    thumb.addEventListener("click", async () => {
      const res = await fetch(thumb.src);
      const blob = await res.blob();
      artInput.value = ""; // no real File in the input for this path
      handleFile(blob);    // Blob works with fileToBase64 the same as a File
    });
  });

  clearBtn.addEventListener("click", () => {
    currentImageBase64 = null;
    artInput.value = "";
    preview.src = "";
    preview.style.display = "none";
    clearBtn.style.display = "none";
    document.getElementById("result").style.display = "none";
  });

  document.getElementById("classifyBtn").addEventListener("click", async () => {
    try {
      console.log("1. Click handler fired");
      if (!currentImageBase64) { console.log("No image selected — stopping"); return; }
      console.log("2. Using selected image, base64 length:", currentImageBase64.length);

      const submitRes = await fetch("https://dorianfirstmetaelinwh4-seforebeepbe-erilea-models.hf.space/gradio_api/call/classify_image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: [{ url: currentImageBase64, meta: { _type: "gradio.FileData" } }] })
      });
      console.log("4. Submit status:", submitRes.status);

      const submitJson = await submitRes.json();
      console.log("5. Submit body:", submitJson);
      const { event_id } = submitJson;
      if (!event_id) { console.error("No event_id! see body logged above"); return; }

      const stream = new EventSource(`https://dorianfirstmetaelinwh4-seforebeepbe-erilea-models.hf.space/gradio_api/call/classify_image/${event_id}`);
      console.log("6. Stream opened for", event_id);

      stream.addEventListener("complete", (e) => {
        const payload = JSON.parse(e.data);
        console.log("7. Result:", payload);
        const predictedClass = payload[0].label;
        let capitalizedClass = predictedClass.charAt(0).toUpperCase() + predictedClass.slice(1);
        setText("predictedClass", capitalizedClass);
        setText("artistBio", artistInfo[predictedClass] || "No info available.");
        renderConfidences(payload[0].confidences);
        document.getElementById("result").style.display = "block";
        stream.close();
      });

      stream.addEventListener("error", (e) => {
        console.error("Stream error:", e);
        stream.close();
      });

    } catch (err) {
      console.error("Caught error:", err);
    }
  });
});

function setText(id, text) {
  const el = document.getElementById(id);
  if (!el) {
    console.error(`No element with id="${id}" found on the page`);
    return;
  }
  el.textContent = text;
}

function fileToBase64(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(file);
  });
}

// Show full confidence breakdown for each of the 20 categories directly from the model
function renderConfidences(confidences) {
  const list = document.getElementById("confidenceList");
  list.innerHTML = "";
  const sorted = [...confidences].sort((a, b) => b.confidence - a.confidence);
  sorted.forEach(({ label, confidence }, index) => {
    const pct = (confidence * 100).toFixed(1);
    const li = document.createElement("li");

    // create text wrappers and assign text safely to prevent XSS
    const labelSpan = document.createElement("span");
    labelSpan.className = "confidence-label";
    labelSpan.textContent = label;

    const pctSpan = document.createElement("span");
    pctSpan.className = "confidence-pct";
    pctSpan.textContent = `${pct}%`;
     
    const barTrack = document.createElement("span");
    barTrack.className = "confidence-bar-track";

    const barFill = document.createElement("span");
    barFill.className = "confidence-bar-fill";
    barFill.style.width = `${pct}%`;
    barTrack.appendChild(barFill);

    if (index === 0) li.classList.add("top-prediction");

    // sequentially append created wrappers to the list
    li.appendChild(labelSpan);
    li.appendChild(barTrack);
    li.appendChild(pctSpan);
    list.appendChild(li);
  });
}