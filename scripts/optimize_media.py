#!/usr/bin/env python3
"""
Optimizador automático de medios para Reconstruyendo Casacuarán.
Se ejecuta en GitHub Actions cuando se suben videos o imágenes nuevas desde Decap CMS (/admin/).

Funciones:
1. Comprime videos nuevos (.mp4, .mov, .m4v, .webm) a H.264 universal + faststart
   respetando orientación horizontal (540p) o vertical 9:16 (540x960).
2. Extrae automáticamente la portada WebP (<nombre>-poster.webp) si no existe.
3. Optimiza fotografías nuevas pesadas (.jpg, .jpeg, .png > 380 KB) generando su versión .webp.
4. Vincula automáticamente las rutas optimizadas y portadas en content/site-data.json.
5. Registra hashes SHA-256 en IMG/.optimized-manifest.json para no recomprimir archivos ya procesados.
"""

from __future__ import annotations

import hashlib
import json
import shutil
import subprocess
import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
IMG_DIR = ROOT_DIR / "IMG"
SITE_DATA_PATH = ROOT_DIR / "content" / "site-data.json"
MANIFEST_PATH = IMG_DIR / ".optimized-manifest.json"

VIDEO_EXTENSIONS = {".mp4", ".mov", ".m4v", ".webm"}
IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png"}
IMAGE_SIZE_THRESHOLD = 380 * 1024  # 380 KB


def sha256_of(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def load_manifest() -> dict:
    if MANIFEST_PATH.exists():
        try:
            return json.loads(MANIFEST_PATH.read_text(encoding="utf-8-sig"))
        except Exception:
            return {}
    return {}


def save_manifest(manifest: dict) -> None:
    MANIFEST_PATH.write_text(
        json.dumps(manifest, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )


def probe_video(path: Path) -> dict:
    cmd = [
        "ffprobe",
        "-v", "error",
        "-select_streams", "v:0",
        "-show_entries", "stream=codec_name,width,height:format=duration",
        "-of", "json",
        str(path),
    ]
    res = subprocess.run(cmd, capture_output=True, text=True, check=True)
    data = json.loads(res.stdout or "{}")
    stream = (data.get("streams") or [{}])[0]
    fmt = data.get("format") or {}
    return {
        "codec": stream.get("codec_name", ""),
        "width": int(stream.get("width") or 0),
        "height": int(stream.get("height") or 0),
        "duration": float(fmt.get("duration") or 0.0),
    }


def extract_poster(video_path: Path, poster_path: Path, duration: float) -> bool:
    seek_sec = 1.0 if duration >= 2.5 else max(0.0, duration * 0.25)
    cmd = [
        "ffmpeg", "-y", "-v", "error",
        "-ss", f"{seek_sec:.2f}",
        "-i", str(video_path),
        "-frames:v", "1",
        "-vf", "scale='min(960,iw)':-2",
        "-c:v", "libwebp",
        "-q:v", "80",
        str(poster_path),
    ]
    res = subprocess.run(cmd, capture_output=True, text=True)
    return res.returncode == 0 and poster_path.exists()


def compress_video(video_path: Path, info: dict) -> Path:
    width = info["width"]
    height = info["height"]
    is_vertical = height > width

    if is_vertical:
        scale_filter = "scale='min(540,iw)':-2,hqdn3d=1.2:1.2:5:5"
    else:
        scale_filter = "scale=-2:'min(540,ih)',hqdn3d=1.2:1.2:5:5"

    target_mp4 = video_path.with_suffix(".mp4")
    tmp_output = video_path.with_name(f".tmp_{video_path.stem}.mp4")

    cmd = [
        "ffmpeg", "-y", "-v", "error",
        "-i", str(video_path),
        "-vf", scale_filter,
        "-c:v", "libx264",
        "-preset", "slow",
        "-crf", "27",
        "-maxrate", "780k",
        "-bufsize", "1560k",
        "-pix_fmt", "yuv420p",
        "-profile:v", "high",
        "-movflags", "+faststart",
        "-c:a", "aac",
        "-b:a", "80k",
        str(tmp_output),
    ]
    subprocess.run(cmd, check=True)

    orig_size = video_path.stat().st_size
    new_size = tmp_output.stat().st_size
    needs_codec_fix = info["codec"] != "h264" or video_path.suffix.lower() != ".mp4"

    if new_size < orig_size * 0.92 or needs_codec_fix:
        if video_path != target_mp4 and video_path.exists():
            video_path.unlink()
        shutil.move(str(tmp_output), str(target_mp4))
        saved_mb = (orig_size - new_size) / (1024 * 1024)
        print(
            f"[VIDEO] {video_path.name} -> {target_mp4.name}: "
            f"{orig_size / 1048576:.2f} MB -> {new_size / 1048576:.2f} MB "
            f"(ahorro {saved_mb:.2f} MB)"
        )
        return target_mp4
    else:
        tmp_output.unlink(missing_ok=True)
        print(f"[VIDEO] {video_path.name} ya es ligero ({orig_size / 1048576:.2f} MB).")
        return video_path


def convert_image_to_webp(img_path: Path) -> Path | None:
    webp_path = img_path.with_suffix(".webp")
    cmd = [
        "ffmpeg", "-y", "-v", "error",
        "-i", str(img_path),
        "-vf", "scale='min(1400,iw)':-2",
        "-c:v", "libwebp",
        "-q:v", "80",
        str(webp_path),
    ]
    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode == 0 and webp_path.exists():
        print(
            f"[IMAGEN] {img_path.name} ({img_path.stat().st_size / 1024:.1f} KB) "
            f"-> {webp_path.name} ({webp_path.stat().st_size / 1024:.1f} KB)"
        )
        return webp_path
    return None


def normalize_rel(rel_str: str) -> str:
    return rel_str.strip().lstrip("/")


def update_site_data(renames: dict[str, str], posters: dict[str, str], webps: dict[str, str]) -> bool:
    if not SITE_DATA_PATH.exists():
        return False

    raw = SITE_DATA_PATH.read_text(encoding="utf-8-sig")
    data = json.loads(raw)
    changed = False

    for pub in data.get("publications", []):
        vid = normalize_rel(pub.get("videoUrl") or "")
        if vid:
            if vid != pub.get("videoUrl"):
                pub["videoUrl"] = vid
                changed = True
            if vid in renames:
                pub["videoUrl"] = renames[vid]
                vid = renames[vid]
                changed = True
            poster_candidate = posters.get(vid)
            if not poster_candidate:
                stem = Path(vid).stem
                auto_poster = IMG_DIR / f"{stem}-poster.webp"
                if auto_poster.exists():
                    poster_candidate = f"IMG/{auto_poster.name}"
            if poster_candidate and not pub.get("videoPoster"):
                pub["videoPoster"] = poster_candidate
                changed = True

        img = normalize_rel(pub.get("imageUrl") or "")
        if img:
            if img != pub.get("imageUrl"):
                pub["imageUrl"] = img
                changed = True
            if img in webps:
                if not pub.get("imageFallback"):
                    pub["imageFallback"] = img
                pub["imageUrl"] = webps[img]
                pub["imagePending"] = False
                changed = True
            elif pub.get("imagePending"):
                pub["imagePending"] = False
                changed = True

    if changed:
        SITE_DATA_PATH.write_text(
            json.dumps(data, indent=2, ensure_ascii=False) + "\n",
            encoding="utf-8",
        )
        print("[JSON] content/site-data.json actualizado con rutas optimizadas.")
    return changed


def main() -> int:
    if not IMG_DIR.exists():
        print("Carpeta IMG no encontrada.")
        return 0

    manifest = load_manifest()
    manifest_changed = False
    renames: dict[str, str] = {}
    posters: dict[str, str] = {}
    webps: dict[str, str] = {}

    for file_path in sorted(IMG_DIR.iterdir()):
        if not file_path.is_file() or file_path.name.startswith("."):
            continue

        ext = file_path.suffix.lower()

        if ext in VIDEO_EXTENSIONS:
            if "header_web" in file_path.stem or "header_720p" in file_path.stem:
                continue
            current_hash = sha256_of(file_path)
            recorded = manifest.get(file_path.name)
            if recorded and recorded.get("sha256") == current_hash:
                continue

            old_rel = f"IMG/{file_path.name}"
            info = probe_video(file_path)
            final_video = compress_video(file_path, info)
            final_rel = f"IMG/{final_video.name}"

            if old_rel != final_rel:
                renames[old_rel] = final_rel
                manifest.pop(file_path.name, None)

            poster_file = IMG_DIR / f"{final_video.stem}-poster.webp"
            if not poster_file.exists():
                if extract_poster(final_video, poster_file, info["duration"]):
                    print(f"[POSTER] Creado {poster_file.name}")
                    manifest[poster_file.name] = {
                        "sha256": sha256_of(poster_file),
                        "size": poster_file.stat().st_size,
                    }

            if poster_file.exists():
                posters[final_rel] = f"IMG/{poster_file.name}"

            manifest[final_video.name] = {
                "sha256": sha256_of(final_video),
                "size": final_video.stat().st_size,
            }
            manifest_changed = True

        elif ext in IMAGE_EXTENSIONS and not file_path.stem.endswith("-poster"):
            current_hash = sha256_of(file_path)
            recorded = manifest.get(file_path.name)
            webp_sibling = file_path.with_suffix(".webp")

            if recorded and recorded.get("sha256") == current_hash and webp_sibling.exists():
                continue

            if file_path.stat().st_size > IMAGE_SIZE_THRESHOLD or not webp_sibling.exists():
                created_webp = convert_image_to_webp(file_path)
                if created_webp:
                    webps[f"IMG/{file_path.name}"] = f"IMG/{created_webp.name}"
                    manifest[created_webp.name] = {
                        "sha256": sha256_of(created_webp),
                        "size": created_webp.stat().st_size,
                    }

            manifest[file_path.name] = {
                "sha256": current_hash,
                "size": file_path.stat().st_size,
            }
            manifest_changed = True

    update_site_data(renames, posters, webps)

    if manifest_changed:
        save_manifest(manifest)

    return 0


if __name__ == "__main__":
    sys.exit(main())
