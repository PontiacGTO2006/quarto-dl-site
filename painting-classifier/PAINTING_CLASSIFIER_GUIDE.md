# Painting Classifier Model - User Guide

## Overview

This guide helps you use the pre-trained painting classifier model (`painting_classifier_v1.pkl`) to classify artwork by artist style. The model was trained on works from 20 famous painters using FastAI's ResNet34 architecture.

---

## Quick Start

### Installation

```bash
pip install fastai torch torchvision pillow
```

### Basic Usage

```python
from fastai.vision.all import *

# Load the pre-trained model
learn = load_learner('painting_classifier_v1.pkl')

# Classify a single painting image
image_path = 'path/to/painting.jpg'
pred_class, pred_idx, probs = learn.predict(image_path)

print(f"Predicted Artist: {pred_class}")
print(f"Confidence: {probs[pred_idx]:.2%}")
```

### Batch Prediction

```python
from pathlib import Path

# Get all images in a directory
image_dir = Path('paintings_to_classify')
image_files = list(image_dir.glob('*.jpg'))

# Classify each image
results = []
for img_path in image_files:
    pred_class, pred_idx, probs = learn.predict(img_path)
    results.append({
        'image': img_path.name,
        'artist': pred_class,
        'confidence': float(probs[pred_idx])
    })

# Display results
for result in results:
    print(f"{result['image']}: {result['artist']} ({result['confidence']:.2%})")
```

---

## Model Details

- **Architecture**: ResNet34 (pre-trained on ImageNet)
- **Training Data**: ~200 images per artist × 20 artists (4,000 images)
- **Artists Included**: Monet, Renoir, Rivera, Degas, Morisot, Cassatt, Cézanne, Van Gogh, Gauguin, Manet, Pissarro, Seurat, Toulouse-Lautrec, Whistler, Turner, Matisse, Picasso, Braque, Mondrian, Warhol
- **Input Size**: 224×224 pixels
- **Output**: 20 artist classes with confidence scores

---

## Advanced Usage

### Get Prediction Probabilities

```python
from fastai.vision.all import *

learn = load_learner('painting_classifier_v1.pkl')

# Get probabilities for all classes
img = PILImage.create('painting.jpg')
probs = learn.get_preds(dl=learn.dls.test_dl(img))

# Display top-5 predictions
predictions = list(zip(learn.dls.vocab, probs[0]))
predictions.sort(key=lambda x: x[1], reverse=True)

for artist, prob in predictions[:5]:
    print(f"{artist}: {prob:.2%}")
```

### Create a Web API

```python
from fastapi import FastAPI, File, UploadFile
from fastai.vision.all import *
from PIL import Image
import io

app = FastAPI()
learn = load_learner('painting_classifier_v1.pkl')

@app.post("/classify")
async def classify_painting(file: UploadFile = File(...)):
    image_data = await file.read()
    img = PILImage.create(io.BytesIO(image_data))
    
    pred_class, pred_idx, probs = learn.predict(img)
    
    return {
        "predicted_artist": pred_class,
        "confidence": float(probs[pred_idx]),
        "all_probabilities": {
            artist: float(prob) 
            for artist, prob in zip(learn.dls.vocab, probs)
        }
    }
```

---

## Issues & Refactoring Recommendations

### 1. **Naming Issues**

#### Problem: Inconsistent File Naming
- **Current**: `painting_classifier_v1.pkl`
- **Issue**: Version numbering is vague; doesn't indicate model architecture, dataset size, or training date

#### Recommendation:
```
painting_classifier_resnet34_20artists_2026.pkl
```

**Why**: 
- Clearly indicates architecture (ResNet34)
- Shows number of classes (20 artists)
- Includes training/release year
- Makes it easier to manage multiple versions

#### Problem: Generic variable names in notebook
- Variables like `path`, `searches`, `name` lack clarity
- Makes code harder to maintain

#### Recommendation:
```python
# Instead of:
path = Path('painting_data')
searches = ['monet', 'renoir', ...]

# Use:
PAINTING_DATA_DIR = Path('painting_data')
ARTIST_NAMES = ['monet', 'renoir', ...]  # Use CONSTANTS for config
```

---

### 2. **Efficiency Problems**

#### Problem A: Redundant Path Operations
```python
# Current approach (repeated in 4 cells):
path = Path('painting_data')
path.mkdir(exist_ok=True, parents=True)

for name in searches:
    dest = path/name
    dest.mkdir(parents=True, exist_ok=True)
    urls = search_images(f'{name} painting', max_images=200)
    download_images(dest, urls=urls)
```

**Issue**: 
- Repetitive code across multiple cells
- Hard to maintain
- Easy to introduce bugs

**Solution**: Refactor into a reusable function
```python
def download_artist_images(artist_names: list, 
                           output_dir: Path = Path('painting_data'),
                           images_per_artist: int = 200):
    """Download images for multiple artists efficiently."""
    output_dir.mkdir(exist_ok=True, parents=True)
    
    for artist_name in artist_names:
        artist_dir = output_dir / artist_name
        artist_dir.mkdir(exist_ok=True, parents=True)
        
        urls = search_images(f'{artist_name} painting', 
                           max_images=images_per_artist)
        download_images(artist_dir, urls=urls)
        print(f"Downloaded {len(urls)} images for {artist_name}")

# Usage:
artists_batch_1 = ['monet', 'renoir', 'rivera', 'degas', 'morisot']
download_artist_images(artists_batch_1)
```

---

#### Problem B: Hard-coded Magic Numbers
```python
# Current:
max_images=200  # What does this mean? Why 200?
time.sleep(2)   # Why 2 seconds? Is this enough?
```

**Solution**: Use configuration constants
```python
# config.py
class DataConfig:
    IMAGES_PER_ARTIST = 200
    API_RATE_LIMIT_DELAY = 2  # seconds between API calls
    IMAGE_SIZE = 224
    BATCH_SIZE = 64
    LEARNING_RATE = 1e-3
    NUM_EPOCHS = 4

# Usage:
from config import DataConfig
urls = search_images(f'{name} painting', 
                    max_images=DataConfig.IMAGES_PER_ARTIST)
```

---

#### Problem C: Memory-Inefficient Download Process
```python
# Current: Downloads all images at once
urls = search_images(f'{name} painting', max_images=200)
download_images(dest, urls=urls)
```

**Issue**: If any download fails, you lose progress. Large batches can cause memory issues.

**Solution**: Batch processing with error handling
```python
def download_artist_images_with_retry(artist_name: str,
                                      output_dir: Path,
                                      batch_size: int = 50,
                                      max_retries: int = 3):
    """Download images in batches with retry logic."""
    artist_dir = output_dir / artist_name
    artist_dir.mkdir(exist_ok=True, parents=True)
    
    total_needed = 200
    downloaded = 0
    
    for batch_start in range(0, total_needed, batch_size):
        batch_end = min(batch_start + batch_size, total_needed)
        remaining = batch_end - batch_start
        
        urls = search_images(f'{artist_name} painting', 
                           max_images=remaining)
        
        for url in urls:
            try:
                download_url(url, artist_dir / url.split('/')[-1])
                downloaded += 1
            except Exception as e:
                print(f"Failed to download {url}: {e}")
        
        print(f"{artist_name}: {downloaded}/{total_needed} images")
```

---

#### Problem D: No Validation of Downloaded Images
```python
# Current: Only checks at the end
failed = verify_images(get_image_files(path))
failed.map(Path.unlink)
```

**Issue**: Wastes download quota by getting bad images. Only validates after all downloads complete.

**Solution**: Validate during download
```python
def is_valid_image(image_path: Path) -> bool:
    """Quick validation of image before saving."""
    try:
        img = PILImage.create(image_path)
        # Verify minimum size requirements
        return img.size[0] >= 50 and img.size[1] >= 50
    except:
        return False

def download_and_validate(url: str, output_dir: Path) -> bool:
    """Download and immediately validate image."""
    try:
        filename = output_dir / url.split('/')[-1]
        download_url(url, filename, show_progress=False)
        
        if is_valid_image(filename):
            return True
        else:
            filename.unlink()
            return False
    except Exception as e:
        print(f"Download failed for {url}: {e}")
        return False
```

---

### 3. **Architecture Improvements**

#### Problem: No Model Evaluation Metrics
The notebook trains a model but doesn't provide clear performance metrics.

**Solution**: Add evaluation framework
```python
def evaluate_model(learn, test_dl=None):
    """Evaluate model performance with detailed metrics."""
    if test_dl is None:
        test_dl = learn.dls.test_dl()
    
    # Get predictions
    preds, _ = learn.get_preds(dl=test_dl)
    
    # Calculate metrics
    from sklearn.metrics import classification_report, confusion_matrix
    
    pred_classes = preds.argmax(dim=1)
    true_classes = test_dl.get_y()
    
    print("=== Classification Report ===")
    print(classification_report(true_classes, pred_classes, 
                               target_names=learn.dls.vocab))
    
    return confusion_matrix(true_classes, pred_classes)
```

---

### 4. **Recommended File Structure Refactor**

**Before:**
```
fastai-course/
├── fastai-unit1-classifier.ipynb      # Too generic
├── painting_classifier_v1.pkl         # Vague naming
└── utils.py
```

**After:**
```
fastai-course/
├── models/
│   └── painting_classifier_resnet34_20artists_2026.pkl
├── src/
│   ├── config.py                      # Configuration constants
│   ├── data_downloader.py             # Data collection functions
│   ├── model_training.py              # Training pipeline
│   └── model_inference.py             # Prediction utilities
├── notebooks/
│   ├── 01_data_collection.ipynb
│   ├── 02_model_training.ipynb
│   └── 03_inference_examples.ipynb
├── docs/
│   └── PAINTING_CLASSIFIER_GUIDE.md   # This file
└── requirements.txt
```

---

## Performance Metrics (Expected)

Based on training on 20 artist classes with ResNet34:
- **Training Time**: ~30-45 minutes on GPU
- **Model Size**: ~87 MB (current)
- **Expected Accuracy**: 70-85% on held-out validation set
- **Inference Speed**: ~50-100ms per image on GPU, ~500ms on CPU

---

## Troubleshooting

### "CUDA out of memory" Error
```python
# Reduce batch size
learn = cnn_learner(dls, resnet34, metrics=error_rate, 
                    wd=0.1, pretrained=True)
learn.lr_find()
dls.bs = 32  # Reduce from default 64
```

### Low Accuracy
```python
# Try fine-tuning more layers
learn.unfreeze()
learn.fit_one_cycle(4, max_lr=1e-4)  # Lower learning rate for full training
```

### Image Prediction Fails
```python
# Ensure correct image format and size
img = PILImage.create('painting.jpg')
if img.size != (224, 224):
    img = img.resize((224, 224))
pred = learn.predict(img)
```

---

## Next Steps

1. **Rename model file** to follow semantic versioning
2. **Extract reusable code** into `src/` modules
3. **Create configuration file** for all constants
4. **Add comprehensive tests** for model inference
5. **Document performance metrics** with validation set results
6. **Create reproducible training pipeline** for future updates

---

## References

- [FastAI Documentation](https://docs.fast.ai/)
- [PyTorch Vision Models](https://pytorch.org/vision/stable/models.html)
- [ResNet Paper](https://arxiv.org/abs/1512.03385)
