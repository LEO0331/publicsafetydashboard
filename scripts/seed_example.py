from __future__ import annotations

from import_pdf import import_pdf

EXAMPLE_PDF_URL = "https://www-ws.gov.taipei/Download.ashx?u=LzAwMS9VcGxvYWQvMzkwL3JlbGZpbGUvNTgyNDQvOTU3NTUyOS9mZTdlZGE5My0yZDg1LTQ5ZjQtYmIxYi1lYmVhYjAxNjUwNTMucGRm&n=MTE1LjA1LjI36Ie65YyX5biC56ysOTHmrKHphZIo5q%2bSKemnleWPiuaLkua4rOe0r%2beKr%2bWFrOW4g%2bWQjeWWri5wZGY%3d&icon=.pdf"


if __name__ == "__main__":
    count = import_pdf(EXAMPLE_PDF_URL, None, "115.05.23 臺北市酒駕累犯公告")
    print(f"Seeded {count} records")
