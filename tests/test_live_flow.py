import urllib.request
import json

base = "http://localhost:8000"

# 1. Health
with urllib.request.urlopen(f"{base}/health") as r:
    print("HEALTH:", json.loads(r.read()))

# 2. Meta
with urllib.request.urlopen(f"{base}/meta") as r:
    print("META:", list(json.loads(r.read()).keys()))

# 3. Context
req_ctx = urllib.request.Request(
    f"{base}/context",
    data=json.dumps({
        "draft": "Hey prof, I could not submit the lab on time because my laptop died and the deadline was unfair with three other midterms this week. Can I get extra time to finish it?",
        "recipient": "Professor",
        "situation": "Requesting a deadline extension"
    }).encode("utf-8"),
    headers={"Content-Type": "application/json"}
)
with urllib.request.urlopen(req_ctx) as r:
    ctx_res = json.loads(r.read())
    print("CONTEXT STATUS:", ctx_res["status"])
    print("CONTEXT SCENE:", ctx_res["scene"])

# 4. Diagnose
req_diag = urllib.request.Request(
    f"{base}/diagnose",
    data=json.dumps({
        "draft": "Hey prof, I could not submit the lab on time because my laptop died and the deadline was unfair with three other midterms this week. Can I get extra time to finish it?",
        "scene": ctx_res["scene"]
    }).encode("utf-8"),
    headers={"Content-Type": "application/json"}
)
with urllib.request.urlopen(req_diag) as r:
    diag_res = json.loads(r.read())
    print("DIAGNOSE OVERALL:", diag_res.get("overall"))
    print("DIAGNOSE VERDICT:", diag_res.get("verdict"))
    print("DIAGNOSE DIMENSIONS COUNT:", len(diag_res.get("dimensions", [])))
    print("DIAGNOSE FLAGS COUNT:", len(diag_res.get("flags", [])))
    if diag_res.get("flags"):
        print("FIRST FLAG:", diag_res["flags"][0])

print("ALL ENDPOINTS VERIFIED SUCCESSFULLY!")
