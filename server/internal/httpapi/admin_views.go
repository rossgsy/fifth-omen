package httpapi

import (
	"html/template"
	"net/http"

	"github.com/rossgsy/fifth-omen/server/internal/game"
)

type adminRoomsView struct {
	Rooms []game.AdminRoomSnapshot
	Error string
}

var adminLoginTemplate = template.Must(template.New("admin-login").Parse(adminPage(`
<main class="login">
  <h1>Fifth Omen Admin</h1>
  {{if .Error}}<p class="error">That password did not work.</p>{{end}}
  <form method="post" action="/admin/login">
    <label>
      <span>Password</span>
      <input type="password" name="password" autocomplete="current-password" autofocus required>
    </label>
    <button type="submit">Sign in</button>
  </form>
</main>
`)))

var adminDisabledTemplate = template.Must(template.New("admin-disabled").Parse(adminPage(`
<main class="login">
  <h1>Admin Disabled</h1>
  <p class="muted">Set <code>ADMIN_PASSWORD</code> before using admin tools.</p>
</main>
`)))

var adminRoomsTemplate = template.Must(template.New("admin-rooms").Funcs(template.FuncMap{
	"adminError": adminErrorMessage,
}).Parse(adminPage(`
<header>
  <h1>Rooms</h1>
  <form method="post" action="/admin/logout">
    <button type="submit" class="secondary">Sign out</button>
  </form>
</header>

{{if .Error}}<p class="error">{{adminError .Error}}</p>{{end}}

<section>
  <h2>Create Room</h2>
  <form method="post" action="/admin/rooms" class="room-form">
    <label>
      <span>Code</span>
      <input name="code" maxlength="5" pattern="[A-Za-z0-9]{5}" placeholder="auto">
    </label>
    <label>
      <span>PIN</span>
      <input name="pin" inputmode="numeric" maxlength="6" pattern="[0-9]{6}" placeholder="auto">
    </label>
    <label>
      <span>Seats</span>
      <input name="maxSeats" type="number" min="1" max="32" value="8">
    </label>
    <button type="submit">Create</button>
  </form>
</section>

<section>
  <h2>Existing Rooms</h2>
  {{if .Rooms}}
  <table>
    <thead>
      <tr>
        <th>Code</th>
        <th>PIN</th>
        <th>Seats</th>
        <th>Players</th>
        <th>Screens</th>
        <th></th>
      </tr>
    </thead>
    <tbody>
      {{range .Rooms}}
      <tr>
        <td><code>{{.Code}}</code></td>
        <td><code>{{.PIN}}</code></td>
        <td>{{.MaxSeats}}</td>
        <td>{{len .Players}}</td>
        <td>{{.GameScreens}}</td>
        <td>
          <form method="post" action="/admin/rooms/{{.Code}}/delete">
            <button type="submit" class="danger">Delete</button>
          </form>
        </td>
      </tr>
      {{end}}
    </tbody>
  </table>
  {{else}}
  <p class="muted">No rooms yet.</p>
  {{end}}
</section>
`)))

func renderAdminLogin(w http.ResponseWriter, hasError bool) {
	renderHTML(w, http.StatusOK, adminLoginTemplate, struct {
		Error bool
	}{
		Error: hasError,
	})
}

func renderAdminLoginError(w http.ResponseWriter, status int) {
	renderHTML(w, status, adminLoginTemplate, struct {
		Error bool
	}{
		Error: true,
	})
}

func renderAdminDisabled(w http.ResponseWriter) {
	renderHTML(w, http.StatusServiceUnavailable, adminDisabledTemplate, nil)
}

func renderAdminRooms(w http.ResponseWriter, view adminRoomsView) {
	renderHTML(w, http.StatusOK, adminRoomsTemplate, view)
}

func renderHTML(w http.ResponseWriter, status int, tmpl *template.Template, data any) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.WriteHeader(status)
	_ = tmpl.Execute(w, data)
}

func adminErrorMessage(code string) string {
	switch code {
	case "room_exists":
		return "That room code already exists."
	case "invalid_room_code":
		return "Room code must be exactly 5 letters or numbers."
	case "invalid_pin":
		return "PIN must be exactly 6 digits."
	case "room_not_found":
		return "That room no longer exists."
	case "invalid_form":
		return "The form could not be read."
	default:
		return "Something went wrong."
	}
}

func adminPage(body string) string {
	return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Fifth Omen Admin</title>
  <style>
    :root {
      color-scheme: light;
      font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      color: #17202a;
      background: #f5f7fb;
    }
    body {
      margin: 0;
      padding: 32px;
    }
    main, header, section {
      max-width: 980px;
      margin: 0 auto 24px;
    }
    header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
    }
    h1, h2 {
      margin: 0 0 16px;
      font-weight: 700;
    }
    h1 {
      font-size: 28px;
    }
    h2 {
      font-size: 18px;
    }
    section, .login {
      background: #ffffff;
      border: 1px solid #d8dee8;
      border-radius: 8px;
      padding: 20px;
      box-shadow: 0 8px 24px rgba(23, 32, 42, 0.06);
    }
    .login {
      max-width: 420px;
      margin-top: 10vh;
    }
    form {
      margin: 0;
    }
    .room-form {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 12px;
      align-items: end;
    }
    label {
      display: grid;
      gap: 6px;
      font-size: 13px;
      font-weight: 600;
    }
    input {
      box-sizing: border-box;
      width: 100%;
      min-height: 40px;
      border: 1px solid #aeb8c6;
      border-radius: 6px;
      padding: 8px 10px;
      font: inherit;
    }
    button {
      min-height: 40px;
      border: 0;
      border-radius: 6px;
      padding: 8px 14px;
      background: #1f6feb;
      color: #fff;
      font: inherit;
      font-weight: 700;
      cursor: pointer;
    }
    button.secondary {
      background: #4b5563;
    }
    button.danger {
      background: #c2410c;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      background: #fff;
    }
    th, td {
      border-bottom: 1px solid #e3e8f0;
      padding: 10px 8px;
      text-align: left;
      vertical-align: middle;
    }
    th {
      font-size: 12px;
      color: #526071;
      text-transform: uppercase;
    }
    code {
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      font-size: 0.95em;
    }
    .error {
      max-width: 980px;
      margin: 0 auto 16px;
      border: 1px solid #f2b8a2;
      border-radius: 6px;
      padding: 10px 12px;
      background: #fff1ec;
      color: #8a2d0d;
    }
    .muted {
      color: #64748b;
    }
    @media (max-width: 720px) {
      body {
        padding: 16px;
      }
      header {
        align-items: flex-start;
      }
      .room-form {
        grid-template-columns: 1fr;
      }
      table {
        display: block;
        overflow-x: auto;
      }
    }
  </style>
</head>
<body>
` + body + `
</body>
</html>`
}
