interface User {
  id: string
  email: string
  name: string
  password: string
}


const users: User[] = [
  {
    id: "1",
    email: "wowdash@gmail.com",
    name: "Wowdash",
    password: "Pa$$w0rd!"
  }
]

export async function getUserFromDb(email: string, hashedPassword: string): Promise<User | null> {
  const find = users.find(user => user.email === email && user.password === hashedPassword)
  return find || null
}
