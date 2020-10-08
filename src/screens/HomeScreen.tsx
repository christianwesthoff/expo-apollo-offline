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
  return (
    <View style={styles.container}>
      <Button onPress={() => navigation.navigate("About")} title="Show About" />
      <NewPost />
      <PostList />
    </View>
  );
};

export default HomeScreen;
