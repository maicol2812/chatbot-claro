from flask import Flask, render_template, request, redirect, url_for, send_from_directory
import pandas as pd
import os
import logging
from pathlib import Path

# Configuración básica
app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = 'static/instructivos'

# Configuración de logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Columnas requeridas del CSV
REQUIRED_COLUMNS = {
    'Fabricante': 'Fabricante',
    'Servicio': 'SERVICIO Y/O SISTEMA GESTIONADO',
    'Texto1': 'TEXTO 1 DE LA ALARMA',
    'Severidad': 'SEVERIDAD',
    'Instructivo': 'KM (TITULO DEL INSTRUCTIVO)',
    'Tier1': 'TIER 1',
    'Tier2': 'TIER 2',
    'Tier3': 'TIER 3',
    'Grupo': 'GRUPO DE ATENCIÓN'
}

# Variable global para el DataFrame
df_alarmas = None

def load_csv():
    """Carga y valida el CSV de alarmas"""
    global df_alarmas
    
    try:
        # Leer CSV con optimización de memoria
        df = pd.read_csv('CatalogoAlarmas.csv', 
                        encoding='utf-8',
                        low_memory=False,
                        sep=';',  # Separador específico
                        dtype={col: str for col in REQUIRED_COLUMNS.values()})
        
        # Verificar columnas requeridas
        missing_cols = [col for col in REQUIRED_COLUMNS.values() if col not in df.columns]
        
        if missing_cols:
            logger.warning(f"Columnas faltantes en CSV: {missing_cols}")
            # Agregar columnas faltantes con valores vacíos
            for col in missing_cols:
                df[col] = "No especificado"
        
        # Normalizar columnas
        df = df.fillna("No especificado")
        
        # Almacenar en variable global
        df_alarmas = df
        logger.info(f"CSV cargado exitosamente. Filas: {len(df)}")
        
        return True
        
    except Exception as e:
        logger.error(f"Error cargando CSV: {str(e)}")
        return False

@app.route('/')
def home():
    return render_template('home.html')

@app.route('/buscar_alarma', methods=['GET', 'POST'])
def buscar_alarma():
    if request.method == 'POST':
        numero = request.form.get('numero', '').strip()
        elemento = request.form.get('elemento', '').strip()
        
        if not df_alarmas is None:
            # Buscar coincidencias (case insensitive)
            mask = df_alarmas.apply(lambda x: x.astype(str).str.contains(numero, case=False).any() and 
                                             x.astype(str).str.contains(elemento, case=False).any(), axis=1)
            
            resultados = df_alarmas[mask]
            
            if len(resultados) > 0:
                alarma = resultados.iloc[0]
                
                # Verificar si existe PDF del instructivo
                pdf_path = None
                if alarma['KM (TITULO DEL INSTRUCTIVO)'] != "No especificado":
                    pdf_name = f"{alarma['KM (TITULO DEL INSTRUCTIVO)']}.pdf"
                    if os.path.exists(os.path.join(app.config['UPLOAD_FOLDER'], pdf_name)):
                        pdf_path = pdf_name
                
                return render_template('resultados.html',
                                    alarma=alarma,
                                    pdf_path=pdf_path)
            
        return render_template('resultados.html', 
                             error="No se encontró la alarma con esos datos")
    
    return render_template('buscar_alarma.html')

@app.route('/instructivo/<filename>')
def serve_pdf(filename):
    """Sirve los archivos PDF de instructivos"""
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

if __name__ == '__main__':
    # Crear directorio de instructivos si no existe
    os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
    
    # Cargar CSV al iniciar
    if not load_csv():
        logger.error("Error crítico cargando CSV. Asegúrate que existe y tiene el formato correcto.")
    
    # Puerto para Render
    port = int(os.environ.get('PORT', 10000))
    app.run(host='0.0.0.0', port=port)