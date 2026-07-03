# Failure Knowledge Base

Record recurring failures and proven fixes.

## Template

### Failure title

- Date first seen:
- Symptoms:
- Error text:
- Cause:
- Fix:
- Verification:
- Prevention:

---

## Known failures

### Port 8788 already in use

- Symptoms: Hermes/Hermex cannot start or browser cannot connect.
- Check:

    ss -ltnp | grep ':8788'

- Fix:

    fuser -k 8788/tcp

- Verification:

    curl -I http://127.0.0.1:8788 || true

### GitHub auth expired

- Symptoms: `gh` commands fail.
- Check:

    gh auth status

- Fix:

    gh auth login

### Tailscale IP changed

- Symptoms: iPhone cannot reach old Hermex URL.
- Check:

    tailscale ip -4

- Fix: Update saved Hermex URL to current Tailscale IP.
