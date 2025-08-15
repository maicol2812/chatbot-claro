from flask import Flask, render_template, request, send_from_directory, jsonify
import pandas as pd
import os
import logging
from pathlib import Path
from werkzeug.middleware.proxy_fix import ProxyFix

# ======================
# CONFIGURACIÓN GLOBAL
# ======================
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

BASE_DIR = Path(__file__).resolve().parent
ALARMAS_FILE = BASE_DIR / 'CatalogoAlarmas.csv'
INSTRUCTIVOS_DIR = BASE_DIR / 'instructivos'

# Crear app Flask
app = Flask(__name__)
app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1, x_prefix=1)

# ======================
# RUTA PRINCIPAL
# ======================
@app.route('/')
def home():
    return render_template('index.html')

# ======================
# RUTA PARA BUSCAR ALARMAS
# ======================
@app.route('/buscar', methods=['GET'])
def buscar():
    numero = request.args.get('numero', '').strip()
    elemento = request.args.get('elemento', '').strip()

    if not ALARMAS_FILE.exists():
        return jsonify({'error': 'Archivo CSV no encontrado'}), 500

    try:
        df = pd.read_csv(ALARMAS_FILE, dtype=str)
        df = df.fillna('')

        resultados = df[
            df['Número de alarma'].str.contains(numero, case=False, na=False) &
            df['Elemento'].str.contains(elemento, case=False, na=False)
        ]

        return jsonify(resultados.to_dict(orient='records'))

    except Exception as e:
        logger.error(f"Error al buscar alarmas: {e}")
        return jsonify({'error': str(e)}), 500

# ======================
# RUTA PARA DESCARGAR INSTRUCTIVO
# ======================
@app.route('/instructivo/<nombre>')
def descargar_instructivo(nombre):
    try:
        return send_from_directory(INSTRUCTIVOS_DIR, nombre, as_attachment=True)
    except FileNotFoundError:
        return jsonify({'error': 'Instructivo no encontrado'}), 404

# ======================
# RUTA DE SALUD
# ======================
@app.route('/health')
def health():
    return jsonify({'status': 'ok'}), 200

# ======================
# MAIN
# ======================
if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port)
