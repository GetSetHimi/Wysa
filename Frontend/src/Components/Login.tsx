import { Input } from './ui/input'

function login() {
  return (
    <>
    <Input type="email" placeholder="Email" />
    <Input type="password" placeholder="Password"/>
     <button className="bg-blue-500 text-white px-4 py-2 rounded">Log In</button>
    </>
  )
}

export default login