# Gomezrosado Mail Credentials

Sensitive operational note created on `2026-04-25`.

These credentials were generated for the staged `gomezrosado.com.do` mail migration in `SimpleHostMan`.

They were applied and validated on the new stack on `2026-04-25`.

## Initial migration passwords

- `alfrygomez@gomezrosado.com.do` -> `AlfryMail26!`
- `asistente.legal@gomezrosado.com.do` -> `AsistLegal26!`
- `contacto@gomezrosado.com.do` -> `Contacto26!GR`
- `francheska.abreu@gomezrosado.com.do` -> `Francheska26!`
- `legal@gomezrosado.com.do` -> `LegalMail26!`
- `maria.abreu@gomezrosado.com.do` -> `MariaAbreu26!`
- `tecnologia@gomezrosado.com.do` -> `TecnoMail26!`

## Legacy passwords adopted from `vps-old`

Updated on `2026-04-25` to preserve the credentials already in use by existing mail clients.

- `alfrygomez@gomezrosado.com.do` -> `kgooijz0fmx4k4oUzL`
- `maria.abreu@gomezrosado.com.do` -> `rhF6FN985V13WXUHpR`
- `gestion@gomezrosado.com.do` -> `rhF6FN985V13WXUHpR`
- `legal@gomezrosado.com.do` -> `4KKJgWikQ2EMPvJK8v`
- `contacto@gomezrosado.com.do` -> `4KKJgWikQ2EMPvJK8v`
- `tecnologia@gomezrosado.com.do` -> `YzxJBob4DBnsrIwKVC`

`asistente.legal@gomezrosado.com.do` was not included in the provided legacy-password list, so it remains on the previously staged SimpleHostMan credential until a source password is provided.

## Mailbox rename on `2026-04-26`

- mailbox renamed: `francheska.abreu@gomezrosado.com.do` -> `gestion@gomezrosado.com.do`
- preserved login credential for `gestion@gomezrosado.com.do`: `rhF6FN985V13WXUHpR`
- receiving alias added: `francheska.abreu@gomezrosado.com.do` -> `gestion@gomezrosado.com.do`

Operational note:

- `gestion@gomezrosado.com.do` is now the real mailbox for IMAP, SMTP submission, and webmail login
- `francheska.abreu@gomezrosado.com.do` remains valid as a receiving alias, not as a mailbox login

## Alias Policy

- legacy cPanel catch-all `*@gomezrosado.com.do -> wmgomezrosado` was **not** carried over
- `SimpleHostMan` target posture keeps the catch-all disabled to avoid silent spam sink behavior
- explicit role aliases are preferred instead

Explicit aliases staged for the new stack:

- `postmaster@gomezrosado.com.do` -> `contacto@gomezrosado.com.do`
- `abuse@gomezrosado.com.do` -> `contacto@gomezrosado.com.do`
- `webmaster@gomezrosado.com.do` -> `contacto@gomezrosado.com.do`
- `francheska.abreu@gomezrosado.com.do` -> `gestion@gomezrosado.com.do`

## Operational Note

These passwords should be treated as initial migration credentials.

Credential rotation is conditional after public cutover: rotate an account
through SimpleHostMan if the mailbox owner requests a post-migration password
change or if operational policy requires replacing the migration password.
