

import pandas as pd
import os
import json
import re

# --- CONFIGURACIÓN ---
CSV_FILE_PATH = '../data.csv'
OUTPUT_JSON_PATH = 'videos.json'
VIDEOS_DIR = 'videos'

# --- FUNCIÓN DE LIMPIEZA ---
def sanitize_filename(name):
    name = name.strip()
    name = re.sub(r'[\\/*?:"<>|]', "", name)
    name = name.replace(' ', '_')
    return name

# --- SCRIPT PRINCIPAL ---
def main():
    print("Iniciando la preparación de datos para la aplicación web HTML...")
    try:
        df = pd.read_csv(CSV_FILE_PATH)
        if 'ejercicio' not in df.columns:
            raise KeyError("La columna 'ejercicio' no se encuentra en el CSV.")
    except FileNotFoundError:
        print(f"Error: No se encontró el archivo CSV en '{CSV_FILE_PATH}'.")
        return

    video_data = []
    for index, row in df.iterrows():
        numero_ejercicio = f"{(index + 1):03d}"
        nombre_ejercicio_original = row['ejercicio']
        nombre_sanitizado = sanitize_filename(nombre_ejercicio_original)
        
        video_filename = f"{numero_ejercicio}-{nombre_sanitizado}.mp4"
        video_path_for_html = f"videos/{video_filename}" # Ruta relativa para HTML
        video_path_on_disk = os.path.join(VIDEOS_DIR, video_filename)

        if not os.path.exists(video_path_on_disk):
            print(f"Aviso: No se encontró '{video_filename}'. Se omitirá.")
            continue

        video_data.append({
            'id': index,
            'title': nombre_ejercicio_original,
            'number': numero_ejercicio,
            'src': video_path_for_html
        })

    with open(OUTPUT_JSON_PATH, 'w', encoding='utf-8') as f:
        json.dump(video_data, f, indent=2, ensure_ascii=False)

    print(f"¡Éxito! Se procesaron {len(video_data)} videos y se guardaron en {OUTPUT_JSON_PATH}")

if __name__ == '__main__':
    main()

