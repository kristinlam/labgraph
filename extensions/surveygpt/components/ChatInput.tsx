// @ts-nocheck
'use client';

import { PaperAirplaneIcon, MicrophoneIcon } from '@heroicons/react/24/solid';
import {
  addDoc,
  getDocs,
  collection,
  serverTimestamp,
} from 'firebase/firestore';
import { useSession } from 'next-auth/react';
import { FormEvent, useState } from 'react';
import { toast } from 'react-hot-toast';
import { db } from '../firebase';
import ModelSelection from './ModelSelection';
import useSWR from 'swr';
import { useRef, useEffect } from 'react';

import useRecorder from '../hooks/useRecorder';

type Props = {
  chatId: string;
};

interface Window {
  webkitSpeechRecognition: any;
}

function ChatInput({ chatId }: Props) {
  const [prompt, setPrompt] = useState('');
  const { data: session } = useSession();

  // initialize useRecorder hook
  let [audioURL, isRecording, startRecording, stopRecording, audioBlob] =
    useRecorder();

  const [startedRecording, setStartedRecording] = useState(false);

  const { data: model, mutate: setModel } = useSWR('model', {
    fallbackData: 'gpt-3.5-turbo',
  });

  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;

  // instantiate speech recognition object
  const recognition = new SpeechRecognition();

  var current, transcript, upperCase;

  // recording event handler
  const startRecord = (e) => {
    // capture the event
    recognition.start(e);

    recognition.onresult = (e) => {
      // after the event has been processed by the browser, get the index
      current = e.resultIndex;
      // get the transcript from the processed event
      transcript = e.results[current][0].transcript;
      // the transcript is in lower case so set firse char to upper case
      upperCase = transcript.charAt(0).toUpperCase() + transcript.substring(1);
      // console.log("voice event", e)
      // console.log("transcript", transcript)
      setPrompt(transcript);
    };
  };

  const sendMessage = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!prompt) return;

    const input = prompt.trim();
    setPrompt('');

    const message: Message = {
      text: input,
      createdAt: serverTimestamp(),
      user: {
        _id: session?.user?.email!,
        name: session?.user?.name!,
        avatar:
          session?.user?.image! ||
          `https://ui-avatars.com/api/?name=${session?.user?.name}`,
      },
      thumbsUp: false,
      thumbsDown: false,
    };

    await addDoc(
      collection(
        db,
        'users',
        session?.user?.email!,
        'chats',
        chatId,
        'messages'
      ),
      message
    );

    // Query the Firebase database to get all messages for this chat
    const querySnapshot = await await getDocs(
      collection(
        db,
        'users',
        session?.user?.email!,
        'chats',
        chatId,
        'messages'
      )
    );

    const chatHistory = querySnapshot.docs.map((doc) => doc.data());
    // console.log("Snapshot", querySnapshot)

    const notification = toast.loading('SpeechGPT is thinking...');

    await fetch('/api/askQuestion', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: input,
        chatId,
        model,
        chatHistory,
        session,
      }),
    }).then(() => {
      // Toast notification to say sucessful!
      toast.success('SpeechGPT has responded!', {
        id: notification,
      });
    });
  };

  return (
    <div className="text-sm m-2 mt-3">
      <form onSubmit={sendMessage} className="flex">
        <input
          className="flex-1 text-custom-black py-2 px-4 rounded-3xl bg-custom-gray-100 focus:outline-none disabled:cursor-not-allowed disabled:text-gray-300 placeholder-custom-gray-300"
          disabled={!session}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          type="text"
          placeholder="Type your answer"
        />

        <div className="flex">
          <button
            onClick={(e) => {
              setStartedRecording(true);
              startRecord(e);
            }}
            className={`${
              isRecording ? 'text-custom-blue' : 'text-custom-black'
            } hover:bg-gray-200 p-2 rounded-full`}
          >
            <MicrophoneIcon className="w-6 h-6" />
          </button>

          <button
            disabled={!prompt || !session}
            type="submit"
            className="text-custom-blue hover:bg-gray-200
          p-2 rounded-full disabled:hover:bg-transparent disabled:text-custom-gray-200"
          >
            <PaperAirplaneIcon className="w-6 h-6" />
          </button>
        </div>
      </form>

      <div>
        <div className="md:hidden">
          <ModelSelection></ModelSelection>
        </div>
      </div>
    </div>
  );
}

export default ChatInput;
