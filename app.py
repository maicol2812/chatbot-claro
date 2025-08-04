from flask import Flask, render_template, jsonify, request, send_file
import pandas as pd
import os
import logging
from pathlib import Path

# Configuración básica de logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = Flask(__name__)

# Configuración
EXCEL_PATH = 'CatalogoAlarmas.csv'
REQUIRED_COLUMNS = {
    'NUMERO_ALARMA': ['NUMERO_ALARMA', 'NUMERO ALARMA', 'ALARMA', 'ID_ALARMA'],
    'ELEMENTO': ['ELEMENTO', 'DISPOSITIVO', 'EQUIPO'],
    'DESCRIPCION': ['DESCRIPCION', 'DESCRIPCIÓN', 'DESC'],
    'PLATAFORMA': ['PLATAFORMA', 'SISTEMA', 'PLAT']
}
CATALOGO_CSV = 'CatalogoAlarmas.csv'
INSTRUCTIVOS_DIR = 'instructivos'

def load_excel():
    """Carga y normaliza el Excel de alarmas"""
    try:
        if not os.path.exists(EXCEL_PATH):
            logger.error(f"Excel no encontrado: {EXCEL_PATH}")
            return None

        # Leer Excel en chunks para optimizar memoria
        df_chunks = pd.read_excel(
            EXCEL_PATH,
            engine='openpyxl',
            chunksize=5000  # Procesar en grupos de 5000 filas
        )
        
        dfs = []
        for chunk in df_chunks:
            # Normalizar nombres de columnas
            chunk.columns = [str(col).strip().upper().replace(' ', '_') for col in chunk.columns]
            dfs.append(chunk)
        
        df = pd.concat(dfs, ignore_index=True)
        
        # Verificar y mapear columnas requeridas
        column_mapping = {}
        missing_columns = []
        
        for required, alternates in REQUIRED_COLUMNS.items():
            found = False
            for alt in alternates:
                if alt.upper().replace(' ', '_') in df.columns:
                    column_mapping[required] = alt.upper().replace(' ', '_')
                    found = True
                    break
            if not found:
                missing_columns.append(required)
                # Crear columna vacía si falta
                df[required] = "NO_ESPECIFICADO"
                logger.warning(f"Columna {required} no encontrada - creando columna vacía")

        if missing_columns:
            logger.warning(f"Columnas faltantes: {missing_columns}")
        
        logger.info(f"Excel cargado exitosamente. Filas: {len(df)}")
        return df
        
    except Exception as e:
        logger.error(f"Error cargando Excel: {str(e)}", exc_info=True)
        return None

def load_catalogo():
    try:
        df = pd.read_csv(CATALOGO_CSV, encoding='utf-8')
        return df
    except Exception as e:
        print(f"Error cargando CSV: {e}")
        return pd.DataFrame()

def buscar_alarma(numero, elemento):
    df = load_catalogo()
    if df.empty:
        return None
        
    # Buscar coincidencias en todas las columnas de texto
    mask = df.apply(lambda x: str(numero).lower() in str(x).lower(), axis=1)
    matches = df[mask]
    
    if not matches.empty:
        # Filtrar por elemento
        elemento_matches = matches[
            matches.apply(lambda x: str(elemento).lower() in str(x).lower(), axis=1)
        ]
        if not elemento_matches.empty:
            return elemento_matches.iloc[0].to_dict()
    
    return None

# Cargar Excel al iniciar
df_alarmas = load_excel()

@app.route('/')
def home():
    return render_template('home.html')

@app.route('/buscar_alarma', methods=['GET', 'POST'])
def buscar_alarma():
    if request.method == 'POST':
        numero = request.form.get('numero_alarma', '').strip()
        elemento = request.form.get('elemento', '').strip().upper()
        
        if not df_alarmas is None:
            try:
                # Filtrar alarmas
                mask = (
                    df_alarmas['NUMERO_ALARMA'].astype(str).str.contains(numero, case=False, na=False) &
                    df_alarmas['ELEMENTO'].astype(str).str.contains(elemento, case=False, na=False)
                )
                resultados = df_alarmas[mask].head(50)  # Limitar a 50 resultados
                
                if len(resultados) > 0:
                    return render_template(
                        'resultados.html',
                        alarmas=resultados.to_dict('records'),
                        numero=numero,
                        elemento=elemento
                    )
                
            except Exception as e:
                logger.error(f"Error en búsqueda: {str(e)}")
                
        return render_template(
            'resultados.html',
            alarmas=[],
            numero=numero,
            elemento=elemento,
            error="⚠️ No se encontró la alarma con esos datos"
        )
        
    return render_template('buscar_alarma.html')

@app.route('/api/buscar_alarma', methods=['POST'])
def api_buscar_alarma():
    data = request.get_json()
    numero = data.get('numero', '')
    elemento = data.get('elemento', '')
    
    alarma = buscar_alarma(numero, elemento)
    
    if alarma:
        # Verificar si existe PDF del instructivo
        km_titulo = str(alarma.get('KM (TITULO DEL INSTRUCTIVO)', ''))
        pdf_path = Path(INSTRUCTIVOS_DIR) / f"{km_titulo}.pdf"
        
        return jsonify({
            'encontrada': True,
            'datos': alarma,
            'tiene_pdf': pdf_path.exists(),
            'pdf_url': f'/instructivo/{km_titulo}.pdf' if pdf_path.exists() else None
        })
    
    return jsonify({
        'encontrada': False,
        'mensaje': 'No encontré la alarma en el catálogo. Verifica el número o el elemento'
    })

@app.route('/instructivo/<filename>')
def serve_pdf(filename):
    if not filename.endswith('.pdf'):
        return "Archivo no autorizado", 403
        
    pdf_path = Path(INSTRUCTIVOS_DIR) / filename
    if pdf_path.exists():
        return send_file(pdf_path, mimetype='application/pdf')
    
    return "PDF no encontrado", 404

if __name__ == '__main__':
    # Crear directorio de instructivos si no existe
    os.makedirs(INSTRUCTIVOS_DIR, exist_ok=True)
    
    # Puerto dinámico para Render
    port = int(os.environ.get('PORT', 10000))
    # Modo debug solo en desarrollo
    debug = os.environ.get('FLASK_ENV') == 'development'
    
    app.run(host='0.0.0.0', port=port, debug=debug)