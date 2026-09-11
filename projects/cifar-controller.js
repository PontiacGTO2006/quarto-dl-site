/**
 * Contains JavaScript fetching logic to hook up predictions from the CIFAR classifier's HuggingFace space to this Quarto site.
 * Also contains the functionality for outputting brief information about the image upon prediction. Code still in progress.
 */

// TODO: Would like to be able to allow users to share this embed using custom code. That's one of the main reasons why this custom UI was designed, aside from making it simpler and more minimalistic than HF.

document.addEventListener("DOMContentLoaded", () => {
  let currentImageBase64 = null; // set by upload, drag-drop, or example click; read by classifyBtn

  const imageInput = document.getElementById("imageInput");
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

  imageInput.addEventListener("change", () => {
    handleFile(imageInput.files[0]);
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
    imageInput.files = dt.files;
    handleFile(file);
  });

  document.querySelectorAll(".example-thumb").forEach((thumb) => {
    thumb.addEventListener("click", async () => {
      const res = await fetch(thumb.src);
      const blob = await res.blob();
      imageInput.value = ""; // no real File in the input for this path
      handleFile(blob);    // Blob works with fileToBase64 the same as a File
    });
  });

  clearBtn.addEventListener("click", () => {
    currentImageBase64 = null;
    imageInput.value = "";
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

      const submitRes = await fetch("https://dorianfirstmetaelinwh4-seforebeepbe-cifar-classifier.hf.space/gradio_api/call/predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: [{ url: currentImageBase64, meta: { _type: "gradio.FileData" } }] })
      });
      console.log("4. Submit status:", submitRes.status);

      const submitJson = await submitRes.json();
      console.log("5. Submit body:", submitJson);
      const { event_id } = submitJson;
      if (!event_id) { console.error("No event_id! see body logged above"); return; }

      const stream = new EventSource(`https://dorianfirstmetaelinwh4-seforebeepbe-cifar-classifier.hf.space/gradio_api/call/predict/${event_id}`);
      console.log("6. Stream opened for", event_id);

      stream.addEventListener("complete", (e) => {
        const payload = JSON.parse(e.data);
        console.log("7. Result:", payload);
        const predictedClass = payload[0].label;
        let capitalizedClass = predictedClass.charAt(0).toUpperCase() + predictedClass.slice(1);
        setText("predictedClass", capitalizedClass);
        setText("additionalInfo", "No info available."); // placeholder string until we set up the additional info for each category
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

// Show full confidence breakdown for each of the 10 categories directly from the model
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