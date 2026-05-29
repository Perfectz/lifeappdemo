"use client";

import { useEffect, useState } from "react";

import { maxHeroNameLength, readProfile, writeHeroName } from "@/client/profile";

export function ProfilePanel() {
  const [name, setName] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setName(readProfile(window.localStorage).heroName);
  }, []);

  function commit(next: string) {
    const applied = writeHeroName(next, window.localStorage);
    setName(applied);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1500);
  }

  return (
    <form
      className="profile-panel"
      onSubmit={(event) => {
        event.preventDefault();
        commit(name);
      }}
    >
      <label className="profile-field">
        <span>Hero name</span>
        <input
          type="text"
          value={name}
          maxLength={maxHeroNameLength}
          onChange={(event) => setName(event.target.value)}
          onBlur={() => commit(name)}
          placeholder="Your name"
          aria-describedby="hero-name-help"
        />
      </label>
      <p id="hero-name-help" className="profile-help">
        Shown on your hero card and used when the AI coach addresses you.
        {saved ? <span className="profile-saved"> Saved.</span> : null}
      </p>
    </form>
  );
}
