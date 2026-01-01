"use client";

import { useSession } from "next-auth/react";
import { useState } from "react";

// Client-side auth but server endpoint is unprotected
export function UserDashboard() {
  const { data: session } = useSession();
  const [users, setUsers] = useState([]);

  // Only render if authenticated on client
  if (!session) {
    return <div>Please log in</div>;
  }

  const deleteUser = async (id: string) => {
    // Calls unprotected API endpoint!
    await fetch(`/api/users?id=${id}`, {
      method: "DELETE",
    });
  };

  const createUser = async (data: any) => {
    // Calls API that ignores validation
    await fetch("/api/users", {
      method: "POST",
      body: JSON.stringify(data),
    });
  };

  return (
    <div>
      <h1>User Dashboard</h1>
      {session && (
        <div>
          <button onClick={() => deleteUser("123")}>Delete User</button>
          <button onClick={() => createUser({ name: "test" })}>Create User</button>
        </div>
      )}
    </div>
  );
}
