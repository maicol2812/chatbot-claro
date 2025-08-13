import multiprocessing

workers = multiprocessing.cpu_count() * 2 + 1
threads = 2
worker_class = 'gthread'

timeout = 120
keepalive = 5

accesslog = '-'
errorlog = '-'
loglevel = 'info'

bind = '0.0.0.0:' + os.environ.get("PORT", "5000")

max_requests = 1000
max_requests_jitter = 50
