import React from "react";
import { FlatList, Text } from "react-native";
import { useOfflineSubscription } from "../extensions/useOfflineSubscription";
import { QUERY_POSTS } from "./operations";

type Data = {
  posts: {
    text: string;
    id: number;
  }[];
};

const PostList: React.FC = () => {
  const { data } = useOfflineSubscription<Data>(QUERY_POSTS);
  // if (loading) return <Text>Loading...</Text>;
  // if (error) return <Text>Error:{error}</Text>;
  if (!data || !data.posts || !data.posts.length) return <Text>No Data</Text>;
  return (
    <>
      <FlatList
        data={data.posts}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => <Text>{item.text}</Text>}
      />
    </>
  );
};

export default PostList;
