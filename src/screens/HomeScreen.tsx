import React, { useState } from "react";
import { StyleSheet, View, Button, Text } from "react-native";
import { StackNavigationProp } from "@react-navigation/stack";

import { StackParams } from "./types";
import NewPost from "../components/NewPost";
import PostList from "../components/PostList";

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#fff",
    flex: 1,
  },
});

type Props = {
  navigation: StackNavigationProp<StackParams>;
};

const HomeScreen: React.FC<Props> = ({ navigation }) => {
  const [mode, setMode] = useState(false);
  return (
    <View style={styles.container}>
      <Button onPress={() => navigation.navigate("About")} title="Show About" />
      <Text>{mode ? "Offline" : "Online"}</Text>
      <NewPost mode={mode} />
      <PostList mode={mode} />
      <Button title="On-/Offline" onPress={() => setMode((s) => !s)} />
    </View>
  );
};

export default HomeScreen;
