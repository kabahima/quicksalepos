class APITrailingSlashMiddleware:
    """Add trailing slash to API requests without one so Vercel routing
    (which may strip trailing slashes) and direct requests both work."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        path = request.path_info
        if (
            path.startswith("/api/")
            and not path.endswith("/")
            and not path.endswith(".json")
        ):
            request.path = path + "/"
            request.path_info = path + "/"
        return self.get_response(request)
