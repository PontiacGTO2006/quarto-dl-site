/**
 * Contains JavaScript fetching logic to hook up predictions from the Ashryver model's HuggingFace space to this Quarto site.
 * Also contains the functionality for outputting brief information about each of the 20 artists, and recommended reading links,
 * upon prediction.
 */

// TODO: capitalize the artist's name in the prediction output so that getting artist info from the artistInfo constant would be made easier
// TODO: display the inputted image somewhere in the output box so that users can see

const artistInfo = {
  "van gogh": "(1853-1890) Dutch Post-Impressionist known for bold color and expressive brushwork.",
  "monet": "French Impressionist, best known for his water lily series.",
  "warhol": "(1928-1987) An American artist and filmmaker whose work explores the relationship between advertising, consumerism, mass media, and celebrity culture.",
  "renoir": "(1841-1919) A French Impressionist whose work is famous for capturing vibrant light, joyful social crowds, and soft feminine beauty.",
  "degas": "(1834-1917) A French artist celebrated for his images of Parisian life.",
  "morisot": "(1841-1895) A leading French painter known for her loose, rapid brushstrokes and luminous use of light.",
  "cassatt": "(1844-1926) An American painter and printmaker known for her tender, realistic portrayals of the social and private lives of women.",
  "cezanne": "(1839-1906) A French post-Impressionist painter known for his revolutionary approach to form, color, and perspective.",
  "gauguin": "(1848-1903) A French Post-Impressionist painter known for bold, flat areas of color and thick outlines.",
  "manet": "(1832-1883) A French painter who bridged the gap between Realism and Impressionism, known for painting everyday contemporary life with bold brushwork."
  // other classes for each artist to be filled (18 to go)
};

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("classifyBtn").addEventListener("click", async () => {
    try {
      console.log("Click handler fired");

      const file = document.getElementById("artInput").files[0];
      if (!file) { console.log("No file selected. Stopping!"); return; }
      console.log("File selected:", file.name);

      const base64 = await fileToBase64(file);
      console.log("Base64 length:", base64.length);

      const submitRes = await fetch("https://dorianfirstmetaelinwh4-seforebeepbe-erilea-models.hf.space/gradio_api/call/classify_image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: [{ url: base64, meta: { _type: "gradio.FileData" } }] })
      });
      console.log("Submit status:", submitRes.status);

      const submitJson = await submitRes.json();
      console.log("Submit body:", submitJson);
      const { event_id } = submitJson;
      if (!event_id) { console.error("No event_id — see body logged above"); return; }

      const stream = new EventSource(`https://dorianfirstmetaelinwh4-seforebeepbe-erilea-models.hf.space/gradio_api/call/classify_image/${event_id}`);
      console.log("Stream opened for", event_id);

      stream.addEventListener("complete", (e) => {
        const payload = JSON.parse(e.data);
        console.log("Result:", payload);
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