/**
 * Contains JavaScript fetching logic to hook up predictions from the Ashryver model's HuggingFace space to this Quarto site.
 * Also contains the functionality for outputting brief information about each of the 20 artists, and recommended reading links,
 * upon prediction.
 */

// TODO: capitalize the artist's name in the prediction output so that getting artist info from the artistInfo constant would be made easier
// TODO: display the inputted image somewhere in the output box so that users can see

const artistInfo = {
  "Van Gogh": "Dutch Post-Impressionist known for bold color and expressive brushwork...",
  "Monet": "French Impressionist, best known for his water lily series...",
  "warhol": "This is simply placeholder text and will be replaced with actual artist information and facts later..."
  // other classes for each artist to be filled (18 to go)
};

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("classifyBtn").addEventListener("click", async () => {
    try {
      console.log("1. Click handler fired");

      const file = document.getElementById("artInput").files[0];
      if (!file) { console.log("No file selected — stopping"); return; }
      console.log("2. File selected:", file.name);

      const base64 = await fileToBase64(file);
      console.log("3. Base64 length:", base64.length);

      const submitRes = await fetch("https://dorianfirstmetaelinwh4-seforebeepbe-erilea-models.hf.space/gradio_api/call/classify_image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: [{ url: base64, meta: { _type: "gradio.FileData" } }] })
      });
      console.log("4. Submit status:", submitRes.status);

      const submitJson = await submitRes.json();
      console.log("5. Submit body:", submitJson);
      const { event_id } = submitJson;
      if (!event_id) { console.error("No event_id — see body logged above"); return; }

      const stream = new EventSource(`https://dorianfirstmetaelinwh4-seforebeepbe-erilea-models.hf.space/gradio_api/call/classify_image/${event_id}`);
      console.log("6. Stream opened for", event_id);

      stream.addEventListener("complete", (e) => {
        const payload = JSON.parse(e.data);
        console.log("7. Result:", payload);
        const predictedClass = payload[0].label;
        setText("predictedClass", predictedClass);
        setText("artistBio", artistInfo[predictedClass] || "No info available.");
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
    console.error(`No element with id="${id}" found on the page`); // output visible error when element isn't found instead of failing silently!!
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