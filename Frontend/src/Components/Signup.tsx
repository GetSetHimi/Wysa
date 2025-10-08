import { Input } from "./ui/input"

function Signup() {
  return (
    <div className="">
        <Input type="email" placeholder="Email" />
        <Input type="password" placeholder="Password"/>
        <Input type="Name" placeholder="Name" />
        <Input type="Age" placeholder="Age" />
        <button className="bg-blue-500 text-white px-4 py-2 rounded">Sign Up</button>
    </div>
  )
}

export default Signup