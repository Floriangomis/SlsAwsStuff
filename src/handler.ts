import { createPost, getPosts, uploadPicture } from './blog'
import { identify, connect, disconnect, manualDisconnect, keepConnectionAlive, sendMessage } from './chat'

const env = process.env.ENV;
console.log('--------- ENV : ' + env + ' --------');

// Blog
export {
  createPost,
  getPosts,
  uploadPicture
}

// Chat
export {
  identify,
  connect,
  disconnect,
  manualDisconnect,
  keepConnectionAlive,
  sendMessage
}
