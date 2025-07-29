from flask import Flask, render_template, jsonify, request, send_from_directory
import pandas as pd
import os
from datetime import datetime
import traceback
from flask import send_file
import numpy as np
from flask_cors import CORS

app = Flask(__name__, static_folder='static', template_folder='templates')
CORS(app)

# Configuración actualizada para el catálogo consolidado
app.config.update({
    'EXCEL_ALARMAS': 'CatalogoAlarmas.xlsx',
    'CARPETA_DOCS': 'documentacion_plataformas',
    'MAX_ALARMAS': 50,
    'TIPOS_SEVERIDAD': ['CRITICA', 'ALTA', 'MEDIA', 'BAJA', 'INFORMATIVA', 'BLOQUEO'],
    'DOMINIOS': ['NETCOOL', 'METOOL', 'SISTEMA', 'Domain amx_ns:.DOM.COLM_TRIARA_U2000_DOM'],
    'SHEET_NAME': 'Afectacion'  # Nombre de la hoja que contiene las alarmas
})

alarmas_cache = None
ultima_actualizacion = None

def crear_datos_demo():
    """Crear datos de demostración cuando no existe el archivo Excel"""
    datos_demo = [
        {
            'ID': 1,
            'Fabricante': 'Huawei',
            'Servicio_Gestionado': 'AAA Huawei',
            'Gestor': 'NETCOOL',
            'Codigo_Alarma': '1003',
            'Descripcion_Corta': 'Module Fault',
            'Descripcion_Larga': 'Error en módulo del sistema',
            'Detalles_Adicionales': 'Módulo principal presenta fallas',
            'Nivel': 'ALTA',
            'Dominio': 'Domain amx_ns:.DOM.COLM_TRIARA_U2000_DOM',
            'Severidad': 'CRITICA',
            'Tipo_Aviso': 'GENERAL',
            'Grupo_Atencion': 'BO CORE',
            'Criticidad': 'ALTA',
            'Dueño_Plataforma': 'EDISON GONZALEZ',
            'Panel_Netcool': 'AEL PACKET CORE VAS II',
            'Elemento': 'AAA Huawei',
            'Fecha': datetime.now().strftime('%Y-%m-%d %H:%M'),
            'Descripcion_Completa': 'Module Fault • Error en módulo del sistema • Módulo principal presenta fallas',
            'Significado': 'Alarma crítica en AAA Huawei - Requiere atención inmediata',
            'Acciones': '1. Verificar estado del equipo • 2. Revisar conectividad • 3. Contactar NOC • 4. Escalar si es necesario'
        },
        {
            'ID': 2,
            'Fabricante': 'Huawei',
            'Servicio_Gestionado': 'GGSN / SAE',
            'Gestor': 'NETCOOL',
            'Codigo_Alarma': '2010',
            'Descripcion_Corta': 'Fan Speed Exceeds Threshold',
            'Descripcion_Larga': 'Ventilador funcionando a velocidad máxima',
            'Detalles_Adicionales': 'Temperatura del sistema elevada',
            'Nivel': 'ALTA',
            'Dominio': 'Domain amx_ns:.DOM.COLM_TRIARA_U2000_DOM',
            'Severidad': 'ALTA',
            'Tipo_Aviso': 'GENERAL',
            'Grupo_Atencion': 'BO CORE',
            'Criticidad': 'ALTA',
            'Dueño_Plataforma': 'EDISON GONZALEZ',
            'Panel_Netcool': 'AEL PACKET CORE VAS II',
            'Elemento': 'GGSN Huawei',
            'Fecha': datetime.now().strftime('%Y-%m-%d %H:%M'),
            'Descripcion_Completa': 'Fan Speed Exceeds Threshold • Ventilador funcionando a velocidad máxima • Temperatura del sistema elevada',
            'Significado': 'Alarma de alta prioridad en GGSN Huawei - Intervención requerida',
            'Acciones': '1. Revisar logs del sistema • 2. Verificar configuración • 3. Monitorear evolución • 4. Documentar solución'
        }
    ]
    return datos_demo

def cargar_alarmas(force=False):
    """Función actualizada para cargar alarmas desde el catálogo consolidado"""
    global alarmas_cache, ultima_actualizacion
    try:
        # Si no existe el archivo Excel, usar datos demo
        if not os.path.exists(app.config['EXCEL_ALARMAS']):
            app.logger.warning(f"Archivo {app.config['EXCEL_ALARMAS']} no encontrado - Usando datos de demostración")
            if not alarmas_cache:
                alarmas_cache = crear_datos_demo()
                ultima_actualizacion = datetime.now().timestamp()
            return alarmas_cache.copy()

        mod_time = os.path.getmtime(app.config['EXCEL_ALARMAS'])
        if not force and alarmas_cache and mod_time <= ultima_actualizacion:
            return alarmas_cache.copy()

        # Leer el archivo Excel
        try:
            # Intentar leer por nombre de hoja primero
            try:
                df = pd.read_excel(app.config['EXCEL_ALARMAS'], sheet_name=app.config['SHEET_NAME'])
            except:
                # Si falla, intentar leer la segunda hoja (índice 1)
                df = pd.read_excel(app.config['EXCEL_ALARMAS'], sheet_name=1)
                
            # Verificar si se cargaron datos
            if df.empty:
                raise ValueError("El archivo Excel no contiene datos o la hoja es incorrecta")
                
        except Exception as e:
            app.logger.error(f"Error leyendo Excel: {str(e)} - Usando datos demo")
            alarmas_cache = crear_datos_demo()
            return alarmas_cache.copy()

        # Limpiar nombres de columnas (remover espacios extra)
        df.columns = df.columns.str.strip()
        
        # Mapeo de columnas específico para el formato del Excel
        column_mapping = {
            'Fabricante': 'Fabricante',
            'SERVICIO Y/O SISTEMA GESTIONADO': 'Servicio_Gestionado',
            'GESTOR': 'Gestor',
            'TEXTO 1 DE LA ALARMA': 'Codigo_Alarma',
            'TEXTO 2 DE LA ALARMA': 'Descripcion_Corta', 
            'TEXTO 3 DE LA ALARMA': 'Descripcion_Larga',
            'TEXTO 4 DE LA ALARMA': 'Detalles_Adicionales',
            'BAJA / ALTA / BLOQUEO': 'Nivel',
            'DOMINIO': 'Dominio',
            'SEVERIDAD': 'Severidad',
            'TIPO DE ALARMA': 'Tipo_Aviso',
            'GRUPO DE ATENCIÓN': 'Grupo_Atencion',
            'CRITICIDAD': 'Criticidad',
            'DUEÑO DE PLATAFORMA': 'Dueño_Plataforma',
            'PANEL NETCOOL': 'Panel_Netcool'
        }

        # Renombrar columnas existentes
        for old_col, new_col in column_mapping.items():
            if old_col in df.columns:
                df.rename(columns={old_col: new_col}, inplace=True)

        # Crear ID único si no existe
        if 'ID' not in df.columns:
            df['ID'] = range(1, len(df) + 1)

        # Crear columna de elemento basada en el servicio gestionado
        if 'Elemento' not in df.columns:
            df['Elemento'] = df.get('Servicio_Gestionado', 'Sistema Desconocido')

        # Agregar fecha si no existe
        if 'Fecha' not in df.columns:
            df['Fecha'] = datetime.now().strftime('%Y-%m-%d %H:%M')

        # Limpiar datos nulos y normalizar
        df = df.fillna('')
        
        # Normalizar severidad y nivel
        for col in ['Severidad', 'Nivel']:
            if col in df.columns:
                df[col] = df[col].astype(str).str.upper().str.strip()
                # Mapear valores comunes
                severidad_map = {
                    'CRITICAL': 'CRITICA',
                    'HIGH': 'ALTA', 
                    'MEDIUM': 'MEDIA',
                    'LOW': 'BAJA',
                    'INFO': 'INFORMATIVA',
                    'BLOQUEO': 'BLOQUEO',
                    'ALTA': 'ALTA',
                    'BAJA': 'BAJA',
                    'AFECTACION': 'MEDIA'
                }
                df[col] = df[col].replace(severidad_map)

        # Crear descripción combinada
        desc_cols = ['Descripcion_Corta', 'Descripcion_Larga', 'Detalles_Adicionales']
        existing_cols = [col for col in desc_cols if col in df.columns]
        df['Descripcion_Completa'] = df[existing_cols].apply(
            lambda x: ' • '.join([str(val) for val in x if str(val).strip()]), axis=1
        )

        # Crear significado y acciones por defecto basados en la severidad/nivel
        def generar_significado_acciones(row):
            severidad = str(row.get('Severidad', '')).upper()
            nivel = str(row.get('Nivel', '')).upper()
            
            # Priorizar el nivel si está definido
            nivel_efectivo = nivel if nivel in ['CRITICA', 'ALTA', 'MEDIA', 'BAJA', 'BLOQUEO'] else severidad
            
            elemento = row.get('Elemento', 'sistema')
            
            if nivel_efectivo == 'CRITICA' or nivel_efectivo == 'BLOQUEO':
                significado = f"Alarma crítica en {elemento} - Requiere atención inmediata"
                acciones = "1. Verificar estado del equipo • 2. Revisar conectividad • 3. Contactar NOC • 4. Escalar si es necesario"
            elif nivel_efectivo == 'ALTA':
                significado = f"Alarma de alta prioridad en {elemento} - Intervención requerida"
                acciones = "1. Revisar logs del sistema • 2. Verificar configuración • 3. Monitorear evolución • 4. Documentar solución"
            elif nivel_efectivo == 'MEDIA':
                significado = f"Alarma de severidad media en {elemento} - Seguimiento necesario"
                acciones = "1. Monitorear comportamiento • 2. Revisar tendencias • 3. Programar mantenimiento • 4. Actualizar documentación"
            else:
                significado = f"Alarma informativa en {elemento} - Para conocimiento"
                acciones = "1. Tomar nota del evento • 2. Revisar si es recurrente • 3. Actualizar base de conocimiento"
            
            return pd.Series([significado, acciones])

        df[['Significado', 'Acciones']] = df.apply(generar_significado_acciones, axis=1)

        # Convertir a diccionario para cache
        alarmas_cache = df.to_dict(orient='records')
        ultima_actualizacion = mod_time
        
        app.logger.info(f"Cargadas {len(alarmas_cache)} alarmas del catálogo consolidado")
        return alarmas_cache.copy()

    except Exception as e:
        app.logger.error(f"Error cargando alarmas: {str(e)}\n{traceback.format_exc()}")
        # En caso de error, devolver datos demo
        if not alarmas_cache:
            alarmas_cache = crear_datos_demo()
        return alarmas_cache.copy()

def buscar_alarma_por_criterios(criterio, valor):
    """Buscar alarmas por diferentes criterios"""
    try:
        alarmas = cargar_alarmas()
        if not alarmas:
            return []

        valor = str(valor).lower().strip()
        resultados = []

        for alarma in alarmas:
            match = False
            
            if criterio == 'id' and str(alarma.get('ID', '')).lower() == valor:
                match = True
            elif criterio == 'elemento' and valor in str(alarma.get('Elemento', '')).lower():
                match = True
            elif criterio == 'servicio' and valor in str(alarma.get('Servicio_Gestionado', '')).lower():
                match = True
            elif criterio == 'codigo' and valor in str(alarma.get('Codigo_Alarma', '')).lower():
                match = True
            elif criterio == 'severidad' and valor in str(alarma.get('Severidad', '')).lower():
                match = True
            elif criterio == 'nivel' and valor in str(alarma.get('Nivel', '')).lower():
                match = True
            elif criterio == 'descripcion' and valor in str(alarma.get('Descripcion_Completa', '')).lower():
                match = True
            elif criterio == 'dominio' and valor in str(alarma.get('Dominio', '')).lower():
                match = True
            elif criterio == 'texto' and (
                valor in str(alarma.get('Descripcion_Completa', '')).lower() or
                valor in str(alarma.get('Elemento', '')).lower() or
                valor in str(alarma.get('Servicio_Gestionado', '')).lower() or
                valor in str(alarma.get('Codigo_Alarma', '')).lower()
            ):
                match = True
                
            if match:
                resultados.append(alarma)

        return resultados[:app.config['MAX_ALARMAS']]
        
    except Exception as e:
        app.logger.error(f"Error buscando alarmas: {str(e)}")
        return []

def obtener_estadisticas_alarmas():
    """Generar estadísticas del catálogo de alarmas"""
    try:
        alarmas = cargar_alarmas()
        if not alarmas:
            return {
                'total': 0,
                'por_severidad': {},
                'por_nivel': {},
                'por_dominio': {},
                'por_fabricante': {},
                'fecha_actualizacion': datetime.now().strftime('%d/%m/%Y %H:%M'),
                'es_demo': not os.path.exists(app.config['EXCEL_ALARMAS'])
            }

        total = len(alarmas)
        por_severidad = {}
        por_nivel = {}
        por_dominio = {}
        por_fabricante = {}
        
        for alarma in alarmas:
            # Contar por severidad
            sev = alarma.get('Severidad', 'NO_DEFINIDA')
            por_severidad[sev] = por_severidad.get(sev, 0) + 1
            
            # Contar por nivel
            nivel = alarma.get('Nivel', 'NO_DEFINIDO')
            por_nivel[nivel] = por_nivel.get(nivel, 0) + 1
            
            # Contar por dominio
            dom = alarma.get('Dominio', 'NO_DEFINIDO')
            por_dominio[dom] = por_dominio.get(dom, 0) + 1
            
            # Contar por fabricante
            fab = alarma.get('Fabricante', 'NO_DEFINIDO')
            por_fabricante[fab] = por_fabricante.get(fab, 0) + 1

        return {
            'total': total,
            'por_severidad': por_severidad,
            'por_nivel': por_nivel,
            'por_dominio': por_dominio,
            'por_fabricante': por_fabricante,
            'fecha_actualizacion': datetime.now().strftime('%d/%m/%Y %H:%M'),
            'es_demo': not os.path.exists(app.config['EXCEL_ALARMAS'])
        }
        
    except Exception as e:
        app.logger.error(f"Error generando estadísticas: {str(e)}")
        return {
            'total': 0,
            'por_severidad': {},
            'por_nivel': {},
            'por_dominio': {},
            'por_fabricante': {},
            'fecha_actualizacion': datetime.now().strftime('%d/%m/%Y %H:%M'),
            'error': str(e),
            'es_demo': not os.path.exists(app.config['EXCEL_ALARMAS'])
        }

# ... [Resto de las funciones y endpoints permanecen iguales] ...

@app.route('/api/alarmas')
def alarmas_api():
    try:
        filtro = request.args.get('filtro', '')
        criterio = request.args.get('criterio', 'texto')
        
        if filtro:
            alarmas = buscar_alarma_por_criterios(criterio, filtro)
        else:
            alarmas = cargar_alarmas()[:app.config['MAX_ALARMAS']]
            
        return jsonify({
            'alarmas': alarmas,
            'total': len(alarmas),
            'criterio': criterio,
            'filtro': filtro,
            'estadisticas': obtener_estadisticas_alarmas()
        })
    except Exception as e:
        app.logger.error(f"Error en alarmas_api: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/alarmas/estadisticas')
def estadisticas_api():
    try:
        return jsonify(obtener_estadisticas_alarmas())
    except Exception as e:
        app.logger.error(f"Error en estadisticas_api: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/alarmas/<int:alarma_id>')
def detalle_alarma_api(alarma_id):
    try:
        alarmas = buscar_alarma_por_criterios('id', alarma_id)
        if alarmas:
            return jsonify(alarmas[0])
        else:
            return jsonify({'error': 'Alarma no encontrada'}), 404
    except Exception as e:
        app.logger.error(f"Error en detalle_alarma_api: {str(e)}")
        return jsonify({'error': str(e)}), 500

# ... [Resto de los endpoints permanecen iguales] ...

def crear_archivos_iniciales():
    """Crear archivos y carpetas necesarios si no existen"""
    try:
        # Crear carpeta de documentos
        if not os.path.exists(app.config['CARPETA_DOCS']):
            os.makedirs(app.config['CARPETA_DOCS'])
            app.logger.info(f"Carpeta {app.config['CARPETA_DOCS']} creada")

        # Verificar si existe el archivo de catálogo
        if not os.path.exists(app.config['EXCEL_ALARMAS']):
            app.logger.warning(f"Archivo {app.config['EXCEL_ALARMAS']} no encontrado")
            app.logger.info("Usando datos de demostración. Para usar datos reales, coloca el archivo Excel en el directorio raíz")
            
    except Exception as e:
        app.logger.error(f"Error creando archivos iniciales: {str(e)}")

if __name__ == '__main__':
    # Configurar logging
    import logging
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    # Crear archivos necesarios
    crear_archivos_iniciales()
    
    # Configuración para desarrollo/producción
    port = int(os.environ.get('PORT', 5000))
    debug_mode = os.environ.get('FLASK_ENV') == 'development'
    
    app.logger.info(f"Iniciando aplicación en puerto {port}")
    app.logger.info(f"Modo debug: {debug_mode}")
    app.logger.info(f"Buscando catálogo: {app.config['EXCEL_ALARMAS']}")
    
    # Cargar alarmas al inicio para verificar funcionamiento
    alarmas_iniciales = cargar_alarmas()
    app.logger.info(f"Cargadas {len(alarmas_iniciales)} alarmas del catálogo")
    
    # Mostrar estado del sistema
    if os.path.exists(app.config['EXCEL_ALARMAS']):
        app.logger.info("✅ Usando datos del archivo Excel")
    else:
        app.logger.info("⚠️  Usando datos de demostración - Coloca el archivo Excel para datos reales")
        
    app.run(host='0.0.0.0', port=port, debug=debug_mode)