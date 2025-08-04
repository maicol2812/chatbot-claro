import multiprocessing

# Configuración de workers
workers = multiprocessing.cpu_count() * 2 + 1
threads = 2
worker_class = 'gthread'

# Timeouts
timeout = 120
keepalive = 5

# Logging
accesslog = '-'
errorlog = '-'
loglevel = 'info'

# Bind
bind = '0.0.0.0:$PORT'

# Max requests
max_requests = 1000
max_requests_jitter = 50
