import { nanoid } from 'nanoid';

export const generateRoomId = () => {
  return `room_${Date.now()}_${nanoid(8)}`;
};

export const generatePeerId = () => {
  return `user_${nanoid(10)}`;
};

export const extractRoomFromUrl = (url) => {
  try {
    const urlObj = new URL(url);
    return {
      room: urlObj.searchParams.get('room'),
      token: urlObj.searchParams.get('token'),
      doc: urlObj.searchParams.get('doc')
    };
  } catch (error) {
    return null;
  }
};
