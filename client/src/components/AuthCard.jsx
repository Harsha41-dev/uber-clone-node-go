import { useState } from "react";
import api, { setToken } from "../api/http";

function AuthCard(props) {
  const onAuth = props.onAuth;
  const [mode, setMode] = useState("register");
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "rider"
  });
  const [message, setMessage] = useState("");

  function handleChange(e) {
    const name = e.target.name;
    const value = e.target.value;

    setForm({
      ...form,
      [name]: value
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setMessage("");

    let url = "/auth/register";
    let payload = form;

    if (mode === "login") {
      url = "/auth/login";
      payload = {
        email: form.email,
        password: form.password
      };
    }

    try {
      const response = await api.post(url, payload);

      setToken(response.data.token);
      localStorage.setItem("uber_auth", JSON.stringify(response.data));
      onAuth(response.data);
      setMessage(`${mode} success`);
    } catch (error) {
      if (error.response && error.response.data && error.response.data.message) {
        setMessage(error.response.data.message);
      } else {
        setMessage("Request failed");
      }
    }
  }

  function switchMode() {
    if (mode === "register") {
      setMode("login");
    } else {
      setMode("register");
    }

    setMessage("");
  }

  return (
    <div className="card">
      <div className="card-head">
        <h2>Quick Auth</h2>
        <button className="ghost-btn" onClick={switchMode}>
          Switch to {mode === "register" ? "login" : "register"}
        </button>
      </div>

      <form onSubmit={handleSubmit} className="form-grid">
        {mode === "register" ? (
          <>
            <input
              name="name"
              placeholder="name"
              value={form.name}
              onChange={handleChange}
            />
            <select name="role" value={form.role} onChange={handleChange}>
              <option value="rider">rider</option>
              <option value="driver">driver</option>
            </select>
          </>
        ) : null}

        <input
          name="email"
          placeholder="email"
          value={form.email}
          onChange={handleChange}
        />
        <input
          name="password"
          type="password"
          placeholder="password"
          value={form.password}
          onChange={handleChange}
        />
        <button className="primary-btn" type="submit">
          {mode}
        </button>
      </form>

      {message ? <p className="message">{message}</p> : null}
    </div>
  );
}

export default AuthCard;
